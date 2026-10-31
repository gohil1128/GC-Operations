import { format, startOfDay, endOfDay, subDays, addDays, differenceInMinutes, eachDayOfInterval } from "date-fns";

export const businessDay = (d: Date | string) => startOfDay(typeof d === "string" ? new Date(d) : d);
export const businessDayEnd = (d: Date | string) => endOfDay(typeof d === "string" ? new Date(d) : d);

export function lastNDays(n: number): { from: Date; to: Date } {
  const to = endOfDay(new Date());
  const from = startOfDay(subDays(to, n - 1));
  return { from, to };
}

export function dayRange(from: Date, to: Date): Date[] {
  return eachDayOfInterval({ start: startOfDay(from), end: startOfDay(to) });
}

export function fmtDate(d: Date | string, pattern = "MMM d, yyyy"): string {
  return format(typeof d === "string" ? new Date(d) : d, pattern);
}

export function fmtTime(d: Date | string, pattern = "h:mm a"): string {
  return format(typeof d === "string" ? new Date(d) : d, pattern);
}

export function fmtDateTime(d: Date | string): string {
  return format(typeof d === "string" ? new Date(d) : d, "MMM d, yyyy h:mm a");
}

export { startOfDay, endOfDay, subDays, addDays, differenceInMinutes };

/** A YYYY-MM-DD filter param, or undefined when absent/malformed. Prevents an
 *  unparseable query string from reaching Prisma and 500-ing the route. */
export function safeDateParam(v?: string | null): string | undefined {
  if (!v) return undefined;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? undefined : v;
}

/*
  The business day, made independent of where the server happens to run.

  `startOfDay(new Date("2026-09-13"))` was the idiom throughout. It works only
  because production runs UTC: the string parses to UTC midnight, and startOfDay
  in UTC leaves it there. Run the same code in Toronto and it snaps back to the
  12th, so every close, payout, deposit, expense and invoice lands a day early.
  A self-hosted deploy (there is a docker-compose.yml) or a platform that sets
  TZ would silently shift the whole ledger.

  These three functions fix the convention in place instead of inheriting it:
  a business day IS the UTC-midnight instant for that calendar date, written and
  read the same way everywhere. That is exactly what the existing rows already
  contain, so nothing needs migrating.
*/

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** YYYY-MM-DD -> the UTC-midnight instant stored for that day. */
export function businessDayFromIso(iso: string): Date {
  const m = ISO_DAY.exec(iso.trim());
  if (!m) {
    // Not silently coerced: a malformed day would otherwise become a real query
    // against some arbitrary instant, or an Invalid Date that Prisma rejects
    // with a stack trace instead of a message.
    throw new Error(`Not a YYYY-MM-DD date: ${iso}`);
  }
  const [, y, mo, d] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  if (Number.isNaN(date.getTime())) throw new Error(`Not a real date: ${iso}`);
  return date;
}

/** The calendar day a stored business date represents. */
export function isoFromBusinessDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Today's calendar date where the business actually trades.
 *
 * This is the one that was visibly wrong: /cash/new defaulted to the server's
 * UTC date, so from 8pm EDT a market's cash close was filed under tomorrow.
 */
export function todayIsoIn(timeZone: string): string {
  // en-CA gives YYYY-MM-DD directly, which is the format every date param uses.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Format a stored business date. Reads it in UTC, because that is the
 * convention it was written with — `fmtDate` would render it in the viewer's
 * timezone and show the previous day to anyone west of Greenwich.
 */
export function fmtBusinessDate(d: Date | string, pattern = "MMM d, yyyy"): string {
  const date = typeof d === "string" ? businessDayFromIso(d) : d;
  // Shift the UTC wall-clock into local so date-fns, which formats in local
  // time, prints the day the instant actually stands for.
  const shifted = new Date(date.getTime() + date.getTimezoneOffset() * 60_000);
  return format(shifted, pattern);
}

/** The last instant of a business day, for an inclusive `lte` range bound. */
export function endOfBusinessDay(iso: string): Date {
  const start = businessDayFromIso(iso);
  return new Date(start.getTime() + 24 * 3600 * 1000 - 1);
}

/**
 * Tolerant form for values off a query string, where a malformed date means
 * "no filter" rather than a 500. Throwing is right for a write — a close must
 * never be filed against a day nobody named — but a bad ?from= should just be
 * ignored the way it always was.
 */
export function businessDayOrNull(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  try {
    return businessDayFromIso(iso);
  } catch {
    return null;
  }
}

export function endOfBusinessDayOrNull(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  try {
    return endOfBusinessDay(iso);
  } catch {
    return null;
  }
}

/**
 * The last `n` calendar days where the business trades, most recent first.
 *
 * Used to ask which days are missing a cash close. That check compared days
 * built from the SERVER's clock against days stored as UTC midnight, so off a
 * UTC server it worked and anywhere else it reported every day missing.
 */
export function recentBusinessDays(timeZone: string, n: number): string[] {
  const todayUtc = businessDayFromIso(todayIsoIn(timeZone));
  const days: string[] = [];
  for (let i = 0; i < n; i++) {
    days.push(isoFromBusinessDay(new Date(todayUtc.getTime() - i * 24 * 3600 * 1000)));
  }
  return days;
}

/*
  Formatting an instant in a named timezone, identically on server and client.

  date-fns `format` works in whatever timezone the process is in. In a client
  component that means the SERVER renders a shift in UTC and the BROWSER
  re-renders it in the viewer's zone, so React finds different text on hydration
  — and, worse than a warning, a 7pm Vancouver shift is bucketed under the next
  calendar day on the server and the correct one in the browser, so it visibly
  jumps to another column.

  Intl with an explicit timeZone gives the same answer in both places. The zone
  to pass is the business's own, not the viewer's: a schedule belongs to where
  the business trades, so a manager checking it from another province should see
  the same grid their staff do.
*/

/** The YYYY-MM-DD calendar day an instant falls on, in a named zone. */
export function dayKeyInZone(value: Date | string, timeZone: string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  // en-CA formats as YYYY-MM-DD, which is the key shape used everywhere else.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** A short wall-clock time in a named zone, e.g. "7:30pm". */
export function timeInZone(value: Date | string, timeZone: string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(d)
    .replace(/\s/g, "")
    .toLowerCase();
}
