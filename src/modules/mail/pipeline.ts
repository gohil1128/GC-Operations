import { Prisma, type MailConnection, type PrismaClient } from "@prisma/client";
import {
  MAX_LOOKBACK_DAYS,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  MAX_ATTEMPTS,
  MAX_MESSAGES_PER_RUN,
  OVERLAP_HOURS,
  RUN_BUDGET_MS,
  RUN_LOCK_MS,
  SKIPPED_RETENTION_DAYS,
} from "./config";
import { ExtractionRefused, type Extraction, type InvoiceExtractor, type MailFile } from "./extract";
import { buildScanQuery, GmailAuthError, type MailClient, type MailItem } from "./gmail";
import { createInvoiceFromEmail } from "./log";
import { assessExtraction, matchSupplierBySender, suggestSupplierByName, type Figures, type SupplierForMatch } from "./rules";

/*
  One scan of one mailbox.

  The order of things matters more than the individual steps, so here it is.

  1. Ask Gmail which messages in the window are worth reading (its own
     categories and a short list of bill words have already thinned them).
  2. Drop every id the ledger has already seen. This is free, and it is what
     makes re-reading the last few hours on every run safe.
  3. For each remaining message, OLDEST FIRST, claim it in the ledger before
     touching it. The unique (connection, gmail id) key means two scans that
     overlap — the schedule and a "Scan now" — cannot both process one email.
  4. Stage one: a cheap read of sender, subject and the first lines. Not a
     bill? Record only its bare id and move on.
  5. Stage two: download the attachments and read the figures.
  6. Plain code decides: is the sender a supplier a person saved, do the
     figures add up, is it under the limit, does it already exist? All yes →
     it becomes an invoice. Anything else → it waits, with the reason.

  Oldest-first is what lets the cursor be honest. If the run has to stop on its
  time budget, everything before the cursor really has been handled, and the
  next run resumes there instead of skipping the rest.
*/

export type ScanDeps = {
  db: PrismaClient;
  mailFor: (connection: MailConnection) => Promise<MailClient>;
  extractor: InvoiceExtractor;
  now?: () => Date;
};

export type ScanResult = {
  connectionId: string;
  ran: boolean;
  /** Why it did not run, when it did not. */
  note?: string;
  listed: number;
  triaged: number;
  logged: number;
  queued: number;
  skipped: number;
  failed: number;
  partial: boolean;
  error?: string;
};

const empty = (connectionId: string): ScanResult => ({
  connectionId, ran: false, listed: 0, triaged: 0, logged: 0, queued: 0, skipped: 0, failed: 0, partial: false,
});

const brief = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/\s+/g, " ").slice(0, 200);

export async function scanConnection(
  connectionId: string,
  trigger: "cron" | "manual",
  deps: ScanDeps,
  /** Look back this many days from now instead of from where the last scan finished (a manual catch-up). */
  opts: { sinceDays?: number } = {},
): Promise<ScanResult> {
  const { db, extractor } = deps;
  const now = deps.now ?? (() => new Date());
  const startedAt = now();
  const result = empty(connectionId);

  const connection = await db.mailConnection.findUnique({
    where: { id: connectionId },
    include: { business: { select: { name: true, currency: true } } },
  });
  if (!connection) return { ...result, note: "No such connection." };
  if (connection.status !== "ACTIVE") return { ...result, note: "The connection needs to be reconnected." };

  // A run that never finished (the function was killed) stops counting after
  // RUN_LOCK_MS, so one crash cannot switch the scanner off for good.
  await db.mailScanRun.updateMany({
    where: { connectionId, finishedAt: null, startedAt: { lt: new Date(startedAt.getTime() - RUN_LOCK_MS) } },
    data: { finishedAt: startedAt, error: "Timed out." },
  });
  const running = await db.mailScanRun.findFirst({ where: { connectionId, finishedAt: null } });
  if (running) return { ...result, note: "A scan is already running." };

  const run = await db.mailScanRun.create({ data: { connectionId, trigger, startedAt } });
  const finish = async (patch: Partial<ScanResult>, cursor?: Date) => {
    Object.assign(result, patch, { ran: true });
    await db.mailScanRun.update({
      where: { id: run.id },
      data: {
        finishedAt: now(), listed: result.listed, triaged: result.triaged, logged: result.logged,
        queued: result.queued, skipped: result.skipped, failed: result.failed,
        partial: result.partial, error: result.error ?? null,
      },
    });
    await db.mailConnection.update({
      where: { id: connectionId },
      data: {
        lastScanAt: now(),
        // Never backwards, and only as far as mail has really been handled.
        ...(cursor && cursor > connection.scannedThrough ? { scannedThrough: cursor } : {}),
      },
    });
    return result;
  };

  let mail: MailClient;
  try {
    mail = await deps.mailFor(connection);
  } catch (e) {
    if (e instanceof GmailAuthError) {
      await markReconnect(db, connectionId);
    }
    return finish({ error: brief(e) });
  }

  try {
    const windowStart = opts.sinceDays
      ? new Date(startedAt.getTime() - opts.sinceDays * 86_400_000)
      : new Date(connection.scannedThrough.getTime() - OVERLAP_HOURS * 3_600_000);
    // A connection left idle for weeks does not go back and read all of it.
    const floor = new Date(startedAt.getTime() - MAX_LOOKBACK_DAYS * 86_400_000);
    const ids = (await mail.listIds(buildScanQuery(windowStart > floor ? windowStart : floor), 500)).reverse();
    result.listed = ids.length;

    const seen = await db.mailMessage.findMany({
      where: { connectionId, gmailId: { in: ids } },
      select: { gmailId: true, status: true, attempts: true, updatedAt: true },
    });
    const seenById = new Map(seen.map((m) => [m.gmailId, m]));
    const retryAfter = new Date(startedAt.getTime() - RUN_LOCK_MS);
    const todo = ids.filter((id) => {
      const s = seenById.get(id);
      if (!s) return true;
      // A failed email is tried again on later scans, a few times, never in a
      // tight loop and never forever.
      return s.status === "FAILED" && s.attempts < MAX_ATTEMPTS && s.updatedAt < retryAfter;
    });

    // Loaded once per run: the supplier list a sender is checked against.
    const suppliers: SupplierForMatch[] = (
      await db.supplier.findMany({
        where: { businessId: connection.businessId },
        select: { id: true, name: true, email: true, mailSenders: { select: { address: true } } },
      })
    ).map((s) => ({ id: s.id, name: s.name, email: s.email, senders: s.mailSenders.map((x) => x.address) }));

    let cursor: Date | null = null;
    let exhausted = false;
    let handled = 0;
    for (const id of todo) {
      if (handled >= MAX_MESSAGES_PER_RUN || now().getTime() - startedAt.getTime() > RUN_BUDGET_MS) {
        exhausted = true;
        break;
      }
      handled++;
      const claimed = await claim(db, connectionId, id, seenById.has(id));
      if (!claimed) continue; // another scan has it

      try {
        const outcome = await processOne({ db, mail, extractor, connection, suppliers, gmailId: id, rowId: claimed, now });
        result[outcome.counter]++;
        if (outcome.triaged) result.triaged++;
        cursor = outcome.receivedAt;
      } catch (e) {
        if (e instanceof GmailAuthError) throw e;
        result.failed++;
        await db.mailMessage.update({
          where: { id: claimed },
          data: { status: "FAILED", reason: brief(e) },
        });
      }
    }

    // Everything listed was handled → the cursor jumps to where this run began.
    // Otherwise it stops at the last message actually handled.
    result.partial = exhausted || ids.length >= 500;
    await db.mailMessage.deleteMany({
      where: { connectionId, status: "SKIPPED", createdAt: { lt: new Date(startedAt.getTime() - SKIPPED_RETENTION_DAYS * 86_400_000) } },
    });
    return finish({}, result.partial ? (cursor ?? undefined) : startedAt);
  } catch (e) {
    if (e instanceof GmailAuthError) await markReconnect(db, connectionId);
    return finish({ error: brief(e) });
  }
}

async function markReconnect(db: PrismaClient, connectionId: string) {
  await db.mailConnection.update({
    where: { id: connectionId },
    data: { status: "NEEDS_RECONNECT", statusNote: "Google no longer accepts this connection. Reconnect it in Settings." },
  });
}

/** Create the ledger row, or take over a retryable one. Null = somebody else has it. */
async function claim(db: PrismaClient, connectionId: string, gmailId: string, retry: boolean): Promise<string | null> {
  if (retry) {
    const row = await db.mailMessage.update({
      where: { connectionId_gmailId: { connectionId, gmailId } },
      data: { attempts: { increment: 1 }, reason: "Processing." },
      select: { id: true },
    });
    return row.id;
  }
  try {
    const row = await db.mailMessage.create({
      data: { connectionId, gmailId, receivedAt: new Date(), status: "FAILED", reason: "Processing.", attempts: 1 },
      select: { id: true },
    });
    return row.id;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return null;
    throw e;
  }
}

type Outcome = {
  counter: "logged" | "queued" | "skipped" | "failed";
  triaged: boolean;
  receivedAt: Date;
};

async function processOne(a: {
  db: PrismaClient;
  mail: MailClient;
  extractor: InvoiceExtractor;
  connection: MailConnection & { business: { name: string; currency: string } };
  suppliers: SupplierForMatch[];
  gmailId: string;
  rowId: string;
  now: () => Date;
}): Promise<Outcome> {
  const { db, mail, extractor, connection } = a;
  const item = await mail.get(a.gmailId);

  const skip = async (): Promise<Outcome> => {
    // Only the bare id is kept — no sender, no subject — so a mailbox of
    // ordinary mail leaves nothing identifying behind.
    await db.mailMessage.update({
      where: { id: a.rowId },
      data: { status: "SKIPPED", receivedAt: item.receivedAt, fromAddress: "", subject: "", reason: null, extracted: Prisma.DbNull },
    });
    return { counter: "skipped", triaged: true, receivedAt: item.receivedAt };
  };

  /* stage one: is it worth a closer look? */
  const triage = await extractor.triage({
    fromAddress: item.fromAddress, fromName: item.fromName, subject: item.subject,
    text: item.text, attachmentNames: item.attachments.map((f) => f.filename),
  });
  if (triage.kind !== "invoice" && triage.kind !== "receipt") return skip();

  /* stage two: read it */
  const held = async (reason: string, extra: Record<string, unknown> = {}, confidence?: number): Promise<Outcome> => {
    await db.mailMessage.update({
      where: { id: a.rowId },
      data: {
        status: "NEEDS_REVIEW", reason, receivedAt: item.receivedAt, confidence: confidence ?? null,
        fromAddress: item.fromAddress, subject: item.subject.slice(0, 200),
        extracted: extra as Prisma.InputJsonValue,
        attachmentName: (extra.attachmentName as string | undefined) ?? null,
      },
    });
    return { counter: "queued", triaged: true, receivedAt: item.receivedAt };
  };

  const picked = pickAttachments(item);
  const files: MailFile[] = [];
  for (const f of picked) files.push({ filename: f.filename, mimeType: f.mimeType, data: await mail.attachment(item.id, f.attachmentId) });

  let x: Extraction;
  try {
    x = await extractor.extract({
      businessName: connection.business.name, fromAddress: item.fromAddress, fromName: item.fromName,
      subject: item.subject, text: item.text, files,
    });
  } catch (e) {
    if (e instanceof ExtractionRefused) return held("The AI declined to read this one — open the email.");
    throw e;
  }
  if (x.document_kind === "other") return skip();

  const assessed = assessExtraction(x, { currency: connection.business.currency, now: a.now(), receivedAt: item.receivedAt });
  const problems = [...assessed.problems];

  const sender = matchSupplierBySender(item.fromAddress, a.suppliers);
  const suggestedSupplierId =
    sender.kind === "match" ? sender.supplierId : suggestSupplierByName(x.supplier_name, a.suppliers);
  if (sender.kind === "none") {
    problems.unshift(
      suggestedSupplierId
        ? `It names a supplier you have, but ${item.fromAddress} is not one of its saved addresses.`
        : `${item.fromAddress} is not a supplier you have saved.`,
    );
  } else if (sender.kind === "ambiguous") {
    problems.unshift(`${item.fromAddress} matches more than one supplier.`);
  }

  // A saved address only counts if Gmail vouches the mail really came from it.
  if (sender.kind === "match" && !item.authenticated) {
    problems.unshift(
      `Gmail could not confirm this really came from ${item.fromAddress} — it failed the sender checks, so it was not logged automatically.`,
    );
  }

  const first = picked[0];
  const extra: Record<string, unknown> = {
    supplierName: x.supplier_name,
    invoiceNumber: assessed.invoiceNumber,
    invoiceDate: assessed.invoiceDate.toISOString().slice(0, 10),
    dateFromEmail: assessed.dateFromEmail,
    currency: x.currency,
    confidence: x.confidence,
    notes: x.notes,
    figures: assessed.figures,
    suggestedSupplierId,
    attachmentId: first?.attachmentId ?? null,
    attachmentName: first?.filename ?? null,
    attachmentMime: first?.mimeType ?? null,
  };

  // An email the same supplier already has this number for is a duplicate of
  // something in the books, not a new bill — whether a person typed it or an
  // earlier copy of this email logged it.
  if (sender.kind === "match" && assessed.invoiceNumber) {
    const dup = await db.invoice.findUnique({
      where: { supplierId_invoiceNumber: { supplierId: sender.supplierId, invoiceNumber: assessed.invoiceNumber } },
      select: { id: true },
    });
    if (dup) {
      await db.mailMessage.update({
        where: { id: a.rowId },
        data: {
          status: "DISMISSED", receivedAt: item.receivedAt, fromAddress: item.fromAddress,
          subject: item.subject.slice(0, 200), confidence: x.confidence,
          reason: `Already in your invoices as #${assessed.invoiceNumber}.`,
          extracted: { ...extra, existingInvoiceId: dup.id } as Prisma.InputJsonValue,
        },
      });
      return { counter: "skipped", triaged: true, receivedAt: item.receivedAt };
    }
  }

  if (problems.length > 0 || sender.kind !== "match" || !assessed.figures) {
    return held(problems.join(" ") || "Needs a look.", extra, x.confidence);
  }

  /* clear on every count: post it */
  await db.mailMessage.update({
    where: { id: a.rowId },
    data: {
      receivedAt: item.receivedAt, fromAddress: item.fromAddress, subject: item.subject.slice(0, 200),
      confidence: x.confidence, extracted: extra as Prisma.InputJsonValue, attachmentName: first?.filename ?? null,
    },
  });
  const made = await createInvoiceFromEmail({
    db, businessId: connection.businessId, locationId: connection.locationId, actorUserId: connection.connectedById,
    supplierId: sender.supplierId, mailMessageId: a.rowId, invoiceNumber: assessed.invoiceNumber, gmailId: item.id,
    invoiceDate: assessed.invoiceDate, receivedAt: item.receivedAt, dateFromEmail: assessed.dateFromEmail,
    figures: assessed.figures as Figures, fromAddress: item.fromAddress, subject: item.subject,
    attachment: files[0] ? { mimeType: files[0].mimeType, data: files[0].data } : null,
  });
  if (!made.ok) {
    await db.mailMessage.update({
      where: { id: a.rowId },
      data: { status: "DISMISSED", reason: `Already in your invoices as #${assessed.invoiceNumber}.`, extracted: { ...extra, existingInvoiceId: made.duplicateOfInvoiceId } as Prisma.InputJsonValue },
    });
    return { counter: "skipped", triaged: true, receivedAt: item.receivedAt };
  }
  return { counter: "logged", triaged: true, receivedAt: item.receivedAt };
}

/** The attachments worth sending, within the limits. PDFs first: they carry the figures best. */
export function pickAttachments(item: Pick<MailItem, "attachments">) {
  const ordered = [...item.attachments].sort((x, y) => Number(y.mimeType === "application/pdf") - Number(x.mimeType === "application/pdf"));
  const out: typeof ordered = [];
  let bytes = 0;
  for (const f of ordered) {
    if (out.length >= MAX_ATTACHMENTS || bytes + f.size > MAX_ATTACHMENT_BYTES) continue;
    out.push(f);
    bytes += f.size;
  }
  return out;
}
