/*
  Every tunable of the mail scanner in one place, with the reason for each.

  Numbers are here rather than inline so that "why does it hold bills over
  $5,000" has one answer you can find, and changing it is a one-line diff.
*/

/** Invoices at or above this are held for a person, however sure the model is. */
export const AUTO_LOG_MAX_CENTS = 500_000; // $5,000

/**
 * Below this confidence the model's own read is not trusted to post by itself.
 * The deterministic checks (known sender, figures that add up) do the real
 * work; this is the last gate for a document the model found hard to read.
 */
export const CONFIDENCE_MIN = 0.85;

/**
 * How far the printed total may differ from subtotal + tax + shipping - discount
 * and still post by itself. Real invoices reconcile to the cent, give or take a
 * cent or two of rounding on the tax. A percentage was tried and rejected: 0.5%
 * is $25 of slack on a $5,000 invoice, which is a wrong figure, not rounding.
 */
export const RECONCILE_TOLERANCE_CENTS = 3;

/** First scan after connecting looks back this far, and no further. */
export const INITIAL_LOOKBACK_DAYS = 7;

/** However long the mailbox sat unscanned, never read back further than this. */
export const MAX_LOOKBACK_DAYS = 28;

/**
 * Each scan re-reads this much before where the last one finished. Mail can
 * arrive late (delivery delay, a filter applying after the fact), and ids
 * already seen are skipped for free, so overlap costs a list call, not a
 * model call.
 */
export const OVERLAP_HOURS = 3;

/** Most emails sent to the model in one run, so one bad day cannot be a big bill. */
export const MAX_MESSAGES_PER_RUN = 40;

/**
 * Stop starting new emails after this long; the next run picks up the rest.
 *
 * The function is limited to 60 seconds, and one email can take 20-30 (a
 * download, then two model calls, one with a PDF). The budget is checked
 * BEFORE starting each email, so it has to leave room for the slowest one to
 * finish — otherwise the platform kills the run mid-email and leaves a ledger
 * row stuck on "processing".
 */
export const RUN_BUDGET_MS = 25_000;

/** A run that never reported finishing stops blocking the next one after this. */
export const RUN_LOCK_MS = 15 * 60_000;

/** A failing email is retried on later scans this many times, then left. */
export const MAX_ATTEMPTS = 3;

/** Bare "skipped" ids are only needed while the lookback can still list them. */
export const SKIPPED_RETENTION_DAYS = 45;

/** Oldest and newest invoice dates that are believable for an emailed bill. */
export const MAX_INVOICE_AGE_DAYS = 180;
export const MAX_INVOICE_FUTURE_DAYS = 7;

/** Text of an email shown to the model — a bill's figures are near the top. */
export const TRIAGE_TEXT_CHARS = 1_500;
export const EXTRACT_TEXT_CHARS = 8_000;

/** Attachments sent to the model: how many, and how many bytes in total. */
export const MAX_ATTACHMENTS = 3;
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

/**
 * Model ids. The default is the current Opus for both stages, which is the
 * safe choice for money records; the triage stage reads every candidate email
 * and is where the cost is, so it can be pointed at a cheaper model without a
 * code change by setting INVOICE_TRIAGE_MODEL.
 */
export const TRIAGE_MODEL = process.env.INVOICE_TRIAGE_MODEL || "claude-opus-5-5";
export const EXTRACT_MODEL = process.env.INVOICE_EXTRACT_MODEL || "claude-opus-5-5";

/** Addresses on these domains prove nothing about who a sender is. */
export const FREE_MAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com",
  "yahoo.com", "yahoo.ca", "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com",
  "gmx.com", "mail.com", "zoho.com", "rogers.com", "bell.net", "sympatico.ca", "shaw.ca",
]);
