"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getScope } from "@/lib/scope";
import { requireCan } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { requiredOwnedId } from "@/lib/ownership";
import { decryptSecret } from "./crypto";
import { revokeToken } from "./gmail";
import { createInvoiceFromEmail } from "./log";
import { scanConnection } from "./pipeline";
import { mailClientFor, productionDeps } from "./service";
import type { Figures } from "./rules";

/*
  What a person can do from the screen.

  Each returns { ok, message } instead of throwing. In production a thrown
  server-action error reaches the browser as a digest with the message
  stripped, which is no use when the useful part is *why*.
*/

type Reply = { ok: true; message: string } | { ok: false; message: string };
const fail = (message: string): Reply => ({ ok: false, message });
const done = (message: string): Reply => ({ ok: true, message });

const refresh = () => {
  revalidatePath("/settings/integrations");
  revalidatePath("/purchasing/invoices");
  revalidatePath("/dashboard");
};

/* Owners connect and scan; anyone who can handle invoices can review them. */

/** Scan now. With `days` (7 or 30) it also catches up that far back; emails already seen are skipped for free. */
export async function scanNowAction(days?: number): Promise<Reply> {
  await requireCan("settings");
  const scope = await getScope();
  const conn = await prisma.mailConnection.findUnique({ where: { businessId: scope.businessId } });
  if (!conn) return fail("Connect Gmail first.");
  const biz = await prisma.business.findUnique({ where: { id: scope.businessId }, select: { aiScanningEnabled: true } });
  if (!biz?.aiScanningEnabled) return fail("AI invoice reading is off. Turn it on in Settings → AI invoice reading.");
  if (conn.status !== "ACTIVE") return fail("The connection needs to be reconnected.");
  // A button people can hold down is a bill; once a minute is plenty.
  if (conn.lastScanAt && Date.now() - conn.lastScanAt.getTime() < 60_000) {
    return fail("It just scanned — give it a minute.");
  }
  try {
    const sinceDays = days === 7 || days === 30 ? days : undefined;
    const r = await scanConnection(conn.id, "manual", productionDeps(), { sinceDays });
    refresh();
    if (!r.ran) return fail(r.note ?? "Nothing ran.");
    if (r.error) return fail(`The scan hit a problem: ${r.error}`);
    const bits = [
      `${r.logged} logged`, `${r.queued} waiting for you`, `${r.skipped} not invoices`,
      ...(r.failed ? [`${r.failed} failed`] : []),
    ];
    return done(`Looked at ${r.listed} email${r.listed === 1 ? "" : "s"}: ${bits.join(", ")}.${r.partial ? " More to do — run it again." : ""}`);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "The scan failed.");
  }
}

export async function disconnectMailAction(): Promise<Reply> {
  await requireCan("settings");
  const scope = await getScope();
  const conn = await prisma.mailConnection.findUnique({ where: { businessId: scope.businessId } });
  if (!conn) return done("Already disconnected.");
  // Revoke at Google first so the grant is really gone, not merely forgotten.
  // Best effort: an unreachable Google must not trap the connection here.
  try {
    await revokeToken(decryptSecret(conn.refreshTokenEnc));
  } catch {
    /* the grant can also be removed from the Google account's connected apps */
  }
  await prisma.mailConnection.delete({ where: { id: conn.id } });
  await writeAudit({
    businessId: scope.businessId, userId: scope.userId,
    action: "mail.disconnect", entityType: "MailConnection", diff: { account: conn.accountEmail },
  });
  refresh();
  return done("Disconnected. Invoices already logged stay as they are.");
}

type Extracted = {
  figures: Figures | null;
  invoiceNumber: string | null;
  invoiceDate: string;
  dateFromEmail: boolean;
  suggestedSupplierId: string | null;
  attachmentId: string | null;
  attachmentMime: string | null;
};

export async function approveMailMessageAction(
  messageId: string,
  supplierId: string,
  rememberSender: boolean,
): Promise<Reply> {
  await requireCan("purchasing");
  const scope = await getScope();

  const msg = await prisma.mailMessage.findFirst({
    where: { id: messageId, connection: { businessId: scope.businessId } },
    include: { connection: true },
  });
  if (!msg) return fail("That email is no longer in the list.");
  if (msg.status !== "NEEDS_REVIEW") return fail("That one has already been dealt with.");

  const x = (msg.extracted ?? {}) as Partial<Extracted>;
  if (!x.figures) {
    return fail("Its figures could not be read reliably — enter this invoice by hand from the email.");
  }
  let supplier: string;
  try {
    supplier = await requiredOwnedId("supplier", scope.businessId, supplierId);
  } catch {
    return fail("Pick which supplier this is from.");
  }

  // The attachment is fetched again now rather than stored: nothing from the
  // mailbox sits in the database any longer than it has to.
  let attachment: { mimeType: string; data: Buffer } | null = null;
  let attachmentDropped: string | null = null;
  if (x.attachmentId && x.attachmentMime) {
    try {
      const mail = await mailClientFor(msg.connection);
      attachment = { mimeType: x.attachmentMime, data: await mail.attachment(msg.gmailId, x.attachmentId) };
    } catch {
      attachmentDropped = "The attachment could not be fetched again — open the email.";
    }
  }

  const made = await createInvoiceFromEmail({
    db: prisma, businessId: scope.businessId, locationId: msg.connection.locationId,
    actorUserId: scope.userId, supplierId: supplier, mailMessageId: msg.id,
    invoiceNumber: x.invoiceNumber ?? null, gmailId: msg.gmailId,
    invoiceDate: new Date(`${x.invoiceDate}T00:00:00.000Z`), receivedAt: msg.receivedAt,
    dateFromEmail: Boolean(x.dateFromEmail), figures: x.figures,
    fromAddress: msg.fromAddress, subject: msg.subject, attachment, attachmentDropped,
    reviewedBy: scope.userId,
  });
  if (!made.ok) {
    await prisma.mailMessage.update({
      where: { id: msg.id },
      data: { status: "DISMISSED", reason: "Already in your invoices.", reviewedById: scope.userId, reviewedAt: new Date() },
    });
    refresh();
    return fail("That supplier already has an invoice with this number, so nothing new was added.");
  }

  if (rememberSender && msg.fromAddress) {
    await prisma.supplierMailSender.upsert({
      where: { supplierId_address: { supplierId: supplier, address: msg.fromAddress.toLowerCase() } },
      create: { supplierId: supplier, address: msg.fromAddress.toLowerCase() },
      update: {},
    });
  }
  refresh();
  return done(rememberSender ? "Logged. Next time this sender's invoices will log themselves." : "Logged.");
}

export async function dismissMailMessageAction(messageId: string): Promise<Reply> {
  await requireCan("purchasing");
  const scope = await getScope();
  const res = await prisma.mailMessage.updateMany({
    where: { id: messageId, status: "NEEDS_REVIEW", connection: { businessId: scope.businessId } },
    data: { status: "DISMISSED", reason: "Dismissed.", reviewedById: scope.userId, reviewedAt: new Date() },
  });
  if (res.count === 0) return fail("That one has already been dealt with.");
  refresh();
  return done("Dismissed.");
}
