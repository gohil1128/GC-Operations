import { describe, expect, it } from "vitest";
import type { Extraction } from "@/modules/mail/extract";
import { assessExtraction, matchSupplierBySender, suggestSupplierByName, type SupplierForMatch } from "@/modules/mail/rules";

/*
  These are the rules that decide whether money posts by itself, so they are
  tested as hard as anything in the app. Each "holds" case names the way a
  wrong invoice would otherwise get into the books.
*/

const suppliers: SupplierForMatch[] = [
  { id: "ravi", name: "Ravi Tent & Rental Ltd.", email: "billing@ravitent.ca", senders: [] },
  { id: "clover", name: "Clover Dairy", email: null, senders: ["orders@cloverdairy.com", "@cloverdairy.com"] },
  { id: "bombay", name: "Bombay Spice Co.", email: "bombay.spice@gmail.com", senders: [] },
  { id: "twin1", name: "Twin A", email: "x@twin.ca", senders: [] },
  { id: "twin2", name: "Twin B", email: "y@twin.ca", senders: [] },
];

describe("who sent it", () => {
  it("matches a supplier's saved address exactly, any case", () => {
    expect(matchSupplierBySender("Billing@RaviTent.ca", suppliers)).toEqual({ kind: "match", supplierId: "ravi", via: "address" });
  });

  it("trusts the supplier's own company domain", () => {
    expect(matchSupplierBySender("accounts@ravitent.ca", suppliers)).toEqual({ kind: "match", supplierId: "ravi", via: "domain" });
  });

  it("honours an explicit @domain a person saved", () => {
    expect(matchSupplierBySender("anyone@cloverdairy.com", suppliers)).toEqual({ kind: "match", supplierId: "clover", via: "domain" });
  });

  it("never trusts a whole free-mail domain, only the exact address", () => {
    // bombay.spice@gmail.com is saved, so a DIFFERENT gmail address is a stranger.
    expect(matchSupplierBySender("bombay.spice@gmail.com", suppliers).kind).toBe("match");
    expect(matchSupplierBySender("someone.else@gmail.com", suppliers).kind).toBe("none");
  });

  it("does not match a lookalike domain", () => {
    expect(matchSupplierBySender("billing@ravitent.ca.evil.com", suppliers).kind).toBe("none");
    expect(matchSupplierBySender("billing@ravi-tent.ca", suppliers).kind).toBe("none");
  });

  it("refuses to guess when two suppliers share a domain", () => {
    const shared = [
      { id: "a", name: "A", email: "a@dist.ca", senders: [] },
      { id: "b", name: "B", email: "b@dist.ca", senders: [] },
    ];
    expect(matchSupplierBySender("new@dist.ca", shared)).toEqual({ kind: "ambiguous", supplierIds: ["a", "b"] });
  });

  it("matches nothing for an empty or malformed address", () => {
    expect(matchSupplierBySender("", suppliers).kind).toBe("none");
    expect(matchSupplierBySender("no-at-sign", suppliers).kind).toBe("none");
  });
});

describe("a name alone only ever SUGGESTS", () => {
  it("finds a supplier by its name, ignoring Ltd/Inc/&", () => {
    expect(suggestSupplierByName("Ravi Tent and Rental", suppliers)).toBe("ravi");
    expect(suggestSupplierByName("CLOVER DAIRY INC.", suppliers)).toBe("clover");
  });
  it("gives up on an ambiguous or too-short name", () => {
    expect(suggestSupplierByName("Twin", suppliers)).toBeNull();
    expect(suggestSupplierByName("Co", suppliers)).toBeNull();
    expect(suggestSupplierByName(null, suppliers)).toBeNull();
  });
});

const NOW = new Date("2026-11-02T15:00:00Z");
const ctx = { currency: "CAD", now: NOW, receivedAt: new Date("2026-11-01T18:30:00Z") };
const ok = (over: Partial<Extraction> = {}): Extraction => ({
  document_kind: "invoice", invoice_count: 1, supplier_name: "Ravi Tent", invoice_number: "3310",
  invoice_date: "2026-10-30", currency: "CAD", subtotal: 230, gst_or_hst: 30, pst_or_qst: 0,
  shipping: 0, discount: 0, total: 260, confidence: 0.96, suspicious: false, notes: null, ...over,
});

describe("what it says — a clean invoice", () => {
  it("passes, in cents, with the total the app would compute", () => {
    const a = assessExtraction(ok(), ctx);
    expect(a.problems).toEqual([]);
    expect(a.figures).toEqual({ subtotalCents: 23000, gstCents: 3000, pstCents: 0, shippingCents: 0, rebateCents: 0, totalCents: 26000 });
    expect(a.invoiceDate.toISOString()).toBe("2026-10-30T00:00:00.000Z");
    expect(a.dateFromEmail).toBe(false);
    expect(a.invoiceNumber).toBe("3310");
  });

  it("takes a total-only receipt at its word", () => {
    const a = assessExtraction(ok({ subtotal: null, gst_or_hst: null, pst_or_qst: null, total: 41.37 }), ctx);
    expect(a.problems).toEqual([]);
    expect(a.figures?.subtotalCents).toBe(4137);
    expect(a.figures?.totalCents).toBe(4137);
  });

  it("derives the subtotal when only tax and total are printed", () => {
    const a = assessExtraction(ok({ subtotal: null, gst_or_hst: 13, pst_or_qst: null, total: 113 }), ctx);
    expect(a.problems).toEqual([]);
    expect(a.figures?.subtotalCents).toBe(10000);
  });

  it("handles shipping and a discount the way the app's own formula does", () => {
    const a = assessExtraction(ok({ subtotal: 100, gst_or_hst: 5, pst_or_qst: 0, shipping: 10, discount: 15, total: 100 }), ctx);
    expect(a.problems).toEqual([]);
    expect(a.figures).toMatchObject({ rebateCents: 1500, shippingCents: 1000, totalCents: 10000 });
  });

  it("forgives a cent or two of rounding but no more", () => {
    expect(assessExtraction(ok({ total: 260.01 }), ctx).problems).toEqual([]);
    expect(assessExtraction(ok({ total: 260.03 }), ctx).problems).toEqual([]);
    expect(assessExtraction(ok({ total: 260.04 }), ctx).problems.join()).toMatch(/do not add up/);
  });

  it("does not let the allowance grow with the size of the bill", () => {
    // 0.5% of $5,000 would be $25. It must stay three cents.
    const big = ok({ subtotal: 4000, gst_or_hst: 520, total: 4520.5 });
    expect(assessExtraction(big, ctx).problems.join()).toMatch(/do not add up/);
  });

  it("falls back to the email's date, and says so, when the document has none", () => {
    const a = assessExtraction(ok({ invoice_date: null }), ctx);
    expect(a.problems).toEqual([]);
    expect(a.dateFromEmail).toBe(true);
    expect(a.invoiceDate.toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });

  it("makes no invoice number up here — the caller does, visibly", () => {
    expect(assessExtraction(ok({ invoice_number: "  " }), ctx).invoiceNumber).toBeNull();
    expect(assessExtraction(ok({ invoice_number: null }), ctx).invoiceNumber).toBeNull();
  });
});

describe("what it says — the ways it is held for a person", () => {
  const holds = (x: Partial<Extraction>, re: RegExp) => {
    const a = assessExtraction(ok(x), ctx);
    expect(a.problems.join(" ")).toMatch(re);
  };

  it("figures that do not add up", () => holds({ total: 999 }, /do not add up.*\$260\.00.*\$999\.00/));
  it("no total at all", () => holds({ total: null }, /no total/i));
  it("a negative figure", () => holds({ gst_or_hst: -30 }, /negative or unreadable/));
  it("a non-finite figure", () => holds({ total: Number.NaN }, /negative or unreadable/));
  it("tax larger than the total", () => holds({ subtotal: null, gst_or_hst: 300, total: 260 }, /more than its total/));
  it("a $0.00 bill", () => holds({ subtotal: 0, gst_or_hst: 0, pst_or_qst: 0, total: 0 }, /\$0\.00/));
  it("a bill over the auto-post limit", () => holds({ subtotal: 5000, gst_or_hst: 650, total: 5650 }, /over the \$5,000\.00/));
  it("exactly at the limit still posts", () => {
    expect(assessExtraction(ok({ subtotal: 5000, gst_or_hst: 0, total: 5000 }), ctx).problems).toEqual([]);
  });
  it("a foreign currency", () => holds({ currency: "usd" }, /Billed in USD.*CAD/));
  it("low confidence", () => holds({ confidence: 0.7 }, /70% sure/));
  it("confidence exactly at the floor posts", () => {
    expect(assessExtraction(ok({ confidence: 0.85 }), ctx).problems).toEqual([]);
  });
  it("a missing or NaN confidence is not trusted", () => holds({ confidence: Number.NaN }, /sure/));
  it("flagged suspicious, with the model's note", () => holds({ suspicious: true, notes: "asks to change bank details" }, /suspicious: asks to change bank details/));
  it("several invoices in one email", () => holds({ invoice_count: 3 }, /holds 3 invoices/));
  it("no invoice found", () => holds({ invoice_count: 0 }, /No invoice could be found/));
  it("a date in the far past", () => holds({ invoice_date: "2025-01-05" }, /more than 180 days ago/));
  it("a date in the future", () => holds({ invoice_date: "2026-12-25" }, /in the future/));
  it("a date a few days ahead is fine", () => {
    expect(assessExtraction(ok({ invoice_date: "2026-11-06" }), ctx).problems).toEqual([]);
  });

  it("never returns figures for a bill it is holding on arithmetic", () => {
    expect(assessExtraction(ok({ total: 999 }), ctx).figures).toBeNull();
  });

  it("collects every problem, not just the first", () => {
    const a = assessExtraction(ok({ currency: "USD", confidence: 0.5, suspicious: true }), ctx);
    expect(a.problems.length).toBeGreaterThanOrEqual(3);
  });
});
