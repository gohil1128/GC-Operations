import { Prisma, type PrismaClient } from "@prisma/client";
import { parseAttachment } from "@/modules/invoices/attachments";
import type { Figures } from "./rules";

/*
  Turning an email into an invoice record. One function, used by the scanner
  when it is sure and by a person's "Approve" when it was not, so both produce
  exactly the same thing and neither can drift from the other.

  WHAT IT WRITES IS A TOTALS-ONLY INVOICE: supplier, number, dates, subtotal,
  tax, shipping, rebate, total, category, and the original document attached.
  No line items. That is deliberate. A line needs an ingredient, an invoice's
  lines move stock, and a model guessing "Masala blend 5kg" is the Masala
  blend you stock would silently change inventory. Totals-only invoices are an
  established path in this app and touch the books and the open-bills figure,
  not stock; anyone can add lines afterwards.

  It writes no event either. Untagged invoices already have a tile on the
  Invoices page asking for exactly that, and an event is a business decision.
*/

const strip = (s: string, n: number) =>
  // Control characters out, length capped. The text is rendered by React, which
  // escapes it — this is about keeping a memo readable, not about injection.
  // eslint-disable-next-line no-control-regex
  s.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, n);

export type CreateFromEmailArgs = {
  db: PrismaClient;
  businessId: string;
  locationId: string;
  /** The author of record: whoever connected the mailbox, or whoever approved. */
  actorUserId: string;
  supplierId: string;
  mailMessageId: string;
  invoiceNumber: string | null;
  /** Used to make a stable number when the document printed none. */
  gmailId: string;
  invoiceDate: Date;
  receivedAt: Date;
  dateFromEmail: boolean;
  figures: Figures;
  fromAddress: string;
  subject: string;
  attachment: { mimeType: string; data: Buffer } | null;
  attachmentDropped?: string | null;
  reviewedBy?: string | null;
};

export type CreateFromEmailResult =
  | { ok: true; invoiceId: string }
  | { ok: false; duplicateOfInvoiceId: string };

export async function createInvoiceFromEmail(a: CreateFromEmailArgs): Promise<CreateFromEmailResult> {
  const number =
    a.invoiceNumber?.trim() ||
    // Stable for this email, so the supplier+number uniqueness blocks a second
    // copy of the same message even though the document had no number.
    `EML-${a.gmailId.slice(-8).toUpperCase()}`;

  // Category: whatever this supplier was last booked under. The model is not
  // asked, because a category decides whether a bill is cost of goods or
  // operating expense, and a wrong guess moves money between P&L lines.
  const last = await a.db.invoice.findFirst({
    where: { supplierId: a.supplierId, category: { not: null } },
    orderBy: { invoiceDate: "desc" },
    select: { category: true },
  });

  let imageDataUrl: string | null = null;
  let attachmentNote = a.attachmentDropped ?? "";
  if (a.attachment) {
    const url = `data:${a.attachment.mimeType};base64,${a.attachment.data.toString("base64")}`;
    try {
      // Same allowlist and size caps as a photo attached by hand.
      parseAttachment(url);
      imageDataUrl = url;
    } catch (e) {
      attachmentNote = `The attachment was not kept (${e instanceof Error ? e.message : "too large"}) — open the email.`;
    }
  }

  const memo = [
    `Logged from an email on ${a.receivedAt.toISOString().slice(0, 10)}${a.reviewedBy ? ", approved by a person" : " automatically"}.`,
    `From ${strip(a.fromAddress, 80)}, subject "${strip(a.subject, 100)}".`,
    a.dateFromEmail ? "The document showed no date, so the email's date was used." : "",
    a.invoiceNumber ? "" : "The document showed no invoice number, so one was made up.",
    attachmentNote,
    "Check it against the attached document.",
  ].filter(Boolean).join(" ");

  try {
    const invoiceId = await a.db.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          locationId: a.locationId,
          supplierId: a.supplierId,
          eventId: null,
          appliesToAllEvents: false,
          category: last?.category ?? null,
          invoiceNumber: number,
          invoiceDate: a.invoiceDate,
          dateReceived: new Date(Date.UTC(a.receivedAt.getUTCFullYear(), a.receivedAt.getUTCMonth(), a.receivedAt.getUTCDate())),
          internalMemo: memo,
          imageDataUrl,
          subtotalCents: a.figures.subtotalCents,
          gstCents: a.figures.gstCents,
          pstCents: a.figures.pstCents,
          shippingCents: a.figures.shippingCents,
          rebateCents: a.figures.rebateCents,
          totalCents: a.figures.totalCents,
          createdById: a.actorUserId,
        },
        select: { id: true },
      });
      await tx.mailMessage.update({
        where: { id: a.mailMessageId },
        data: {
          status: "LOGGED",
          invoiceId: inv.id,
          reason: null,
          ...(a.reviewedBy ? { reviewedById: a.reviewedBy, reviewedAt: new Date() } : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          businessId: a.businessId,
          userId: a.actorUserId,
          action: "invoice.create",
          entityType: "Invoice",
          entityId: inv.id,
          diffJson: { number, source: "email", auto: !a.reviewedBy, from: strip(a.fromAddress, 80) },
        },
      });
      return inv.id;
    });
    return { ok: true, invoiceId };
  } catch (e) {
    // (supplier, invoice number) is unique, so a bill already in the system —
    // typed by hand, or logged from an earlier copy of this email — lands here.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existing = await a.db.invoice.findUnique({
        where: { supplierId_invoiceNumber: { supplierId: a.supplierId, invoiceNumber: number } },
        select: { id: true },
      });
      if (existing) return { ok: false, duplicateOfInvoiceId: existing.id };
    }
    throw e;
  }
}
