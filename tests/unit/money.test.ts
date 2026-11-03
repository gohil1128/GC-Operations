import { describe, it, expect } from "vitest";
import {
  toCents, fromCents, formatMoney, formatMoneyHeadline, formatPercent, safeDivide,
  APP_CURRENCY, APP_LOCALE,
} from "@/lib/money";

/*
  Money is the product. Every figure a customer trusts — cash in hand, over/short,
  margin — runs through these five functions, so they get pinned exactly.
*/

describe("toCents", () => {
  it("converts dollars to integer cents", () => {
    expect(toCents(12.34)).toBe(1234);
    expect(toCents("12.34")).toBe(1234);
    expect(toCents(0)).toBe(0);
  });

  it("rounds rather than truncating, so a half cent does not vanish", () => {
    expect(toCents(0.005)).toBe(1);
    expect(toCents(10.994)).toBe(1099);
    expect(toCents(10.995)).toBe(1100);
  });

  it("survives float representation error at two decimal places", () => {
    // 19.99 * 100 === 1998.9999999999998 in IEEE754. Truncation would lose a cent
    // on a huge share of real prices; Math.round recovers it.
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(1234.56)).toBe(123456);
    expect(toCents(0.07)).toBe(7);
    expect(toCents(1.15)).toBe(115);
  });

  /*
    Known edge, pinned rather than papered over: a three-decimal input can land a
    cent low, because 1.005 * 100 is 100.49999999999999 and rounds down. Every
    money input in the app is step="0.01", so this is only reachable by typing a
    third decimal deliberately. Worth knowing before anyone adds a field that
    computes a price (a per-unit cost, a split) rather than accepting one.
  */
  it("can land a cent low on a three-decimal input", () => {
    expect(toCents(1.005)).toBe(100);
    expect(toCents(0.005)).toBe(1); // 0.5 is exact, so this one rounds up
  });

  it("handles negatives symmetrically", () => {
    expect(toCents(-12.34)).toBe(-1234);
  });

  /*
    Documents a real hazard rather than endorsing it. A non-finite input becomes
    $0.00 silently, so a form that yields NaN writes a zero into the ledger
    instead of refusing. Callers must validate BEFORE calling this — Zod does,
    on the paths that have a schema.
  */
  it("silently swallows non-finite input as zero", () => {
    expect(toCents(NaN)).toBe(0);
    expect(toCents(Infinity)).toBe(0);
    expect(toCents("not a number")).toBe(0);
    expect(toCents("")).toBe(0);
  });

  it("parses leading-numeric strings the way parseFloat does", () => {
    expect(toCents("12.34abc")).toBe(1234);
  });
});

describe("fromCents", () => {
  it("round-trips with toCents", () => {
    for (const d of [0, 0.01, 1, 19.99, 1234.56, -47.5]) {
      expect(fromCents(toCents(d))).toBeCloseTo(d, 10);
    }
  });
});

describe("formatMoney", () => {
  it("formats to two decimal places", () => {
    expect(formatMoney(0)).toBe("$0.00");
    expect(formatMoney(1234)).toBe("$12.34");
    expect(formatMoney(123456789)).toBe("$1,234,567.89");
  });

  it("uses a real minus sign for negatives, not a hyphen", () => {
    // U+2212, matching the report tables.
    expect(formatMoney(-1234)).toBe("−$12.34");
    expect(formatMoney(-1234)).not.toContain("-");
  });

  it("adds a plus only when asked and only when positive", () => {
    expect(formatMoney(1234, { signed: true })).toBe("+$12.34");
    expect(formatMoney(0, { signed: true })).toBe("$0.00");
    expect(formatMoney(-1234, { signed: true })).toBe("−$12.34");
  });
});

describe("formatMoneyHeadline", () => {
  it("keeps cents below $1,000 where they carry information", () => {
    expect(formatMoneyHeadline(1260)).toBe("$12.60");
    expect(formatMoneyHeadline(99999)).toBe("$999.99");
  });

  it("drops cents at $1,000 and above", () => {
    expect(formatMoneyHeadline(100000)).toBe("$1,000");
    expect(formatMoneyHeadline(4385012)).toBe("$43,850");
  });

  it("applies the threshold to magnitude, not sign", () => {
    expect(formatMoneyHeadline(-4385012)).toBe("−$43,850");
    expect(formatMoneyHeadline(-1260)).toBe("−$12.60");
  });
});

describe("formatPercent", () => {
  it("formats to one decimal by default", () => {
    expect(formatPercent(12.345)).toBe("12.3%");
    expect(formatPercent(0)).toBe("0.0%");
  });

  it("returns an em dash rather than NaN% or Infinity%", () => {
    expect(formatPercent(NaN)).toBe("—");
    expect(formatPercent(Infinity)).toBe("—");
    expect(formatPercent(-Infinity)).toBe("—");
  });
});

describe("safeDivide", () => {
  it("divides normally", () => {
    expect(safeDivide(10, 4)).toBe(2.5);
  });

  it("returns zero rather than Infinity when the denominator is zero", () => {
    // A brand-new tenant has zero transactions; Infinity would reach the screen.
    expect(safeDivide(100, 0)).toBe(0);
    expect(safeDivide(0, 0)).toBe(0);
  });
});

/*
  Currency.

  This used to assert the defect: the formatter was hardcoded to en-US/USD for a
  business that trades in Canada. en-CA/CAD renders identically — "$1,234.56" —
  so the mistake was invisible on screen and wrong everywhere the label is what
  is read: by a screen reader, in an exported CSV, by an accounting package.
*/
describe("currency configuration", () => {
  it("formats in Canadian dollars", () => {
    expect(APP_CURRENCY).toBe("CAD");
    expect(APP_LOCALE).toBe("en-CA");
  });

  it("renders the same glyph and grouping it always did", () => {
    // The change is semantic, not visual — nothing on screen should move.
    expect(formatMoney(1234)).toBe("$12.34");
    expect(formatMoney(123456789)).toBe("$1,234,567.89");
    expect(formatMoneyHeadline(4385012)).toBe("$43,850");
  });

  it("actually carries CAD, not just a dollar sign", () => {
    // The part that was wrong before: what the number is LABELLED as.
    const parts = new Intl.NumberFormat(APP_LOCALE, {
      style: "currency",
      currency: APP_CURRENCY,
      currencyDisplay: "code",
    }).formatToParts(12.34);
    expect(parts.find((p) => p.type === "currency")?.value).toBe("CAD");
  });
});
