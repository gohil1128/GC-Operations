export function toCents(value: number | string): number {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (!isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/*
  The currency the app formats in.

  Was hardcoded en-US/USD while the business it was built for trades in Canada.
  Both render "$1,234.56", so nothing looked wrong on screen — but the figures
  were labelled as US dollars everywhere it actually matters: to a screen
  reader, in a CSV opened with a locale-aware tool, and to anyone who exports
  the numbers into an accounting package.

  Configurable by environment rather than a second hardcode, so a deployment
  aimed at another country is a setting and not a patch. NEXT_PUBLIC_ so the
  client components that format money see the same value as the server and
  cannot disagree with it mid-page.

  This is app-wide, not per-business. Every customer is Canadian today, so one
  setting is the truth; several businesses in different currencies on one
  deployment would need the currency threaded through all ~216 call sites,
  which is its own change.
*/
export const APP_LOCALE = process.env.NEXT_PUBLIC_APP_LOCALE || "en-CA";
export const APP_CURRENCY = process.env.NEXT_PUBLIC_APP_CURRENCY || "CAD";

const moneyFormatter = new Intl.NumberFormat(APP_LOCALE, {
  style: "currency",
  currency: APP_CURRENCY,
});

export function formatMoney(cents: number, opts?: { signed?: boolean }): string {
  const value = fromCents(cents);
  const formatted = moneyFormatter.format(Math.abs(value));
  if (opts?.signed && cents > 0) return `+${formatted}`;
  if (cents < 0) return `−${formatted}`;   // U+2212, matching the report tables
  return formatted;
}

export function formatPercent(value: number, fractionDigits = 1): string {
  if (!isFinite(value)) return "—";
  return `${value.toFixed(fractionDigits)}%`;
}

export function safeDivide(num: number, denom: number): number {
  return denom === 0 ? 0 : num / denom;
}

const wholeMoneyFormatter = new Intl.NumberFormat(APP_LOCALE, {
  style: "currency",
  currency: APP_CURRENCY,
  maximumFractionDigits: 0,
});

/**
 * Headline figures: cents on a $12.60 average ticket carry information, cents
 * on a $43,850 season total are noise that costs three characters the display
 * numerals can't spare on a phone. Drops them past $1,000.
 */
export function formatMoneyHeadline(cents: number, opts?: { signed?: boolean }): string {
  const value = fromCents(cents);
  if (Math.abs(value) < 1000) return formatMoney(cents, opts);
  const formatted = wholeMoneyFormatter.format(Math.abs(value));
  if (opts?.signed && cents > 0) return `+${formatted}`;
  if (cents < 0) return `−${formatted}`; // U+2212, matching the report tables
  return formatted;
}
