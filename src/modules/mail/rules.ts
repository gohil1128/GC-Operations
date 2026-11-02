import { businessDayFromIso } from "@/lib/date";
import { impossibleInvoiceReason } from "@/modules/invoices/checks";
import {
  AUTO_LOG_MAX_CENTS,
  CONFIDENCE_MIN,
  FREE_MAIL_DOMAINS,
  MAX_INVOICE_AGE_DAYS,
  MAX_INVOICE_FUTURE_DAYS,
  RECONCILE_TOLERANCE_CENTS,
} from "./config";
import type { Extraction } from "./extract";

/*
  What decides whether a bill posts itself.

  The model reads; this decides. Everything here is plain code on plain
  values, so it can be tested to death and so a person can read why a given
  email was held. Each way an invoice can fail to post is a sentence in
  `problems`, written for the person who will see it in the review list —
  "Over $5,000", not "AMOUNT_CAP".

  The default is to hold. A held invoice costs somebody one tap; a wrong one
  posted by itself is a figure in the books that nobody knows to doubt.
*/

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const toCents = (dollars: number) => Math.round(dollars * 100);

/* ───────────────────────── who sent it ───────────────────────── */

export type SupplierForMatch = {
  id: string;
  name: string;
  email: string | null;
  /** Addresses a person has said this supplier emails from. "@acme.ca" trusts a whole domain. */
  senders: string[];
};

export const domainOf = (address: string) => address.toLowerCase().split("@")[1] ?? "";

export type SenderMatch =
  | { kind: "match"; supplierId: string; via: "address" | "domain" }
  | { kind: "ambiguous"; supplierIds: string[] }
  | { kind: "none" };

/*
  A supplier is identified by WHO SENT THE EMAIL, never by what the document
  says. Anyone can type "Bombay Spice Co." at the top of a PDF; they cannot
  send mail from bombayspice.ca.

  An exact address always counts. A whole domain counts only when it is the
  supplier's own — never a free-mail domain, where "@gmail.com" would trust
  every stranger on earth.
*/
export function matchSupplierBySender(fromAddress: string, suppliers: SupplierForMatch[]): SenderMatch {
  const from = fromAddress.trim().toLowerCase();
  const domain = domainOf(from);
  if (!from || !domain) return { kind: "none" };
  const free = FREE_MAIL_DOMAINS.has(domain);

  const hits = new Map<string, "address" | "domain">();
  for (const s of suppliers) {
    const known = [...(s.email ? [s.email.toLowerCase()] : []), ...s.senders.map((x) => x.toLowerCase())];
    if (known.includes(from)) {
      hits.set(s.id, "address");
      continue;
    }
    if (free) continue;
    // "@acme.ca" explicitly saved, or the domain of the supplier's own saved email.
    const trustedDomains = new Set(
      known
        .map((k) => (k.startsWith("@") ? k.slice(1) : domainOf(k)))
        .filter((d) => d && !FREE_MAIL_DOMAINS.has(d)),
    );
    if (trustedDomains.has(domain)) hits.set(s.id, "domain");
  }

  if (hits.size === 0) return { kind: "none" };
  if (hits.size > 1) return { kind: "ambiguous", supplierIds: [...hits.keys()] };
  const [[supplierId, via]] = [...hits.entries()];
  return { kind: "match", supplierId, via };
}

const NOISE_WORDS = new Set(["inc", "ltd", "limited", "co", "corp", "corporation", "company", "the", "llc", "ulc"]);
const nameKey = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w && !NOISE_WORDS.has(w))
    .join(" ");

/**
 * A guess for the review list only — "this looks like Clover Dairy". It is
 * never used to post anything, because a name is exactly what a forged
 * invoice gets right.
 */
export function suggestSupplierByName(name: string | null | undefined, suppliers: SupplierForMatch[]): string | null {
  const k = nameKey(name ?? "");
  if (k.length < 3) return null;
  const hits = suppliers.filter((s) => {
    const sk = nameKey(s.name);
    return sk.length >= 3 && (sk === k || sk.includes(k) || k.includes(sk));
  });
  return hits.length === 1 ? hits[0].id : null;
}

/* ───────────────────────── what it says ───────────────────────── */

export type Figures = {
  subtotalCents: number;
  gstCents: number;
  pstCents: number;
  shippingCents: number;
  rebateCents: number;
  totalCents: number;
};

export type Assessment = {
  /** Plain-language reasons this should wait for a person. Empty = clear to post. */
  problems: string[];
  figures: Figures | null;
  invoiceDate: Date;
  /** True when the document had no usable date and the email's date stood in. */
  dateFromEmail: boolean;
  /** Set when the document printed no invoice number. */
  invoiceNumber: string | null;
};

export function assessExtraction(
  x: Extraction,
  ctx: { currency: string; now: Date; receivedAt: Date },
): Assessment {
  const problems: string[] = [];

  if (x.invoice_count !== 1) {
    problems.push(
      x.invoice_count > 1
        ? `The email holds ${x.invoice_count} invoices — log each from its attachment.`
        : "No invoice could be found in it.",
    );
  }
  if (x.suspicious) {
    problems.push(`Flagged as suspicious${x.notes ? `: ${x.notes}` : "."}`);
  }
  if (!(x.confidence >= CONFIDENCE_MIN)) {
    problems.push(`Not sure it read the figures right (${Math.round(x.confidence * 100)}% sure).`);
  }
  const cur = x.currency?.trim().toUpperCase();
  if (cur && cur !== ctx.currency.toUpperCase()) {
    problems.push(`Billed in ${cur}; this business keeps its books in ${ctx.currency.toUpperCase()}.`);
  }

  /* — figures — */
  const nums = {
    subtotal: x.subtotal, gst: x.gst_or_hst, pst: x.pst_or_qst,
    shipping: x.shipping, discount: x.discount, total: x.total,
  };
  const bad = Object.entries(nums).filter(([, v]) => v != null && (!Number.isFinite(v) || v < 0));
  let figures: Figures | null = null;

  if (bad.length) {
    problems.push(`A figure it read is negative or unreadable (${bad.map(([k]) => k).join(", ")}).`);
  } else if (nums.total == null) {
    problems.push("There is no total on it.");
  } else {
    const gst = toCents(nums.gst ?? 0);
    const pst = toCents(nums.pst ?? 0);
    const shipping = toCents(nums.shipping ?? 0);
    const rebate = toCents(nums.discount ?? 0);
    const printedTotal = toCents(nums.total);
    // A document that prints only a total (no tax lines, a till receipt) is
    // taken at its word: the total is the subtotal. One that prints a subtotal
    // too must add up.
    const subtotal = nums.subtotal != null ? toCents(nums.subtotal) : printedTotal - gst - pst - shipping + rebate;

    const computed = subtotal + gst + pst + shipping - rebate;
    if (subtotal < 0) {
      problems.push("The tax and shipping on it add up to more than its total.");
    } else if (Math.abs(computed - printedTotal) > RECONCILE_TOLERANCE_CENTS) {
      problems.push(
        `The figures do not add up: they come to ${money(computed)} but it says ${money(printedTotal)}.`,
      );
    } else {
      figures = {
        subtotalCents: subtotal, gstCents: gst, pstCents: pst,
        shippingCents: shipping, rebateCents: rebate,
        // The app derives a total as subtotal + taxes + shipping - rebate, so
        // store exactly that rather than a printed figure a cent or two off.
        totalCents: computed,
      };
      const impossible = impossibleInvoiceReason(figures);
      if (impossible) {
        problems.push(impossible);
        figures = null;
      } else if (computed > AUTO_LOG_MAX_CENTS) {
        problems.push(`${money(computed)} is over the ${money(AUTO_LOG_MAX_CENTS)} it will post by itself.`);
      } else if (computed === 0) {
        problems.push("The total is $0.00.");
      }
    }
  }

  /* — date — */
  let invoiceDate = businessDay(ctx.receivedAt);
  let dateFromEmail = true;
  if (x.invoice_date) {
    try {
      const d = businessDayFromIso(x.invoice_date);
      const ageDays = (ctx.now.getTime() - d.getTime()) / 86_400_000;
      if (ageDays > MAX_INVOICE_AGE_DAYS) {
        problems.push(`Dated ${x.invoice_date}, more than ${MAX_INVOICE_AGE_DAYS} days ago.`);
      } else if (ageDays < -MAX_INVOICE_FUTURE_DAYS) {
        problems.push(`Dated ${x.invoice_date}, which is in the future.`);
      }
      invoiceDate = d;
      dateFromEmail = false;
    } catch {
      /* unparseable: the email's date stands in, and the memo says so */
    }
  }

  const number = (x.invoice_number ?? "").trim().slice(0, 60);
  return { problems, figures, invoiceDate, dateFromEmail, invoiceNumber: number || null };
}

/** The calendar day of an instant, as the UTC-midnight date the app stores. */
function businessDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
