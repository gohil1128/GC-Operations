import { describe, it, expect } from "vitest";
import {
  invoiceTotalCents,
  impossibleInvoiceReason,
  invoiceDiscountWarning,
  isBelowSubtotal,
} from "@/modules/invoices/checks";

const bill = {
  subtotalCents: 10_000,
  gstCents: 500,
  pstCents: 600,
  shippingCents: 0,
  rebateCents: 0,
};

describe("invoiceTotalCents", () => {
  it("is the same arithmetic the action stores", () => {
    expect(invoiceTotalCents(bill)).toBe(11_100);
  });

  it("takes the rebate off", () => {
    expect(invoiceTotalCents({ ...bill, rebateCents: 1_100 })).toBe(10_000);
  });
});

describe("impossibleInvoiceReason", () => {
  it("passes an ordinary bill", () => {
    expect(impossibleInvoiceReason(bill)).toBeNull();
  });

  it("passes a discount that eats the tax but not the goods", () => {
    // $100 of goods, $11 of tax, $30 off. Unusual, entirely possible.
    expect(impossibleInvoiceReason({ ...bill, rebateCents: 3_000 })).toBeNull();
  });

  it("passes a bill discounted to exactly nothing", () => {
    // A full credit is a real thing and lands on zero, not below it.
    expect(impossibleInvoiceReason({ ...bill, rebateCents: 11_100 })).toBeNull();
  });

  it("refuses a rebate one cent past the whole bill", () => {
    const reason = impossibleInvoiceReason({ ...bill, rebateCents: 11_101 });
    expect(reason).not.toBeNull();
    // The two figures that matter are in the sentence, so the operator does
    // not have to work out which box to look in.
    expect(reason).toContain("$111.01");
    expect(reason).toContain("$111.00");
  });

  it("names the negative total it would have stored", () => {
    expect(impossibleInvoiceReason({ ...bill, rebateCents: 20_000 })).toContain("−$89.00");
  });
});

describe("invoiceDiscountWarning", () => {
  it("says nothing when the total covers the goods", () => {
    expect(invoiceDiscountWarning({ subtotalCents: 10_000, totalCents: 11_100 })).toBeNull();
  });

  it("says nothing when they are equal", () => {
    expect(invoiceDiscountWarning({ subtotalCents: 10_000, totalCents: 10_000 })).toBeNull();
  });

  it("flags a total under the goods, and quotes both", () => {
    const note = invoiceDiscountWarning({ subtotalCents: 10_000, totalCents: 9_000 });
    expect(note).toContain("$90.00");
    expect(note).toContain("$100.00");
  });
});

describe("isBelowSubtotal", () => {
  it("agrees with the warning on every boundary", () => {
    for (const totalCents of [9_998, 9_999, 10_000, 10_001]) {
      const flagged = isBelowSubtotal({ subtotalCents: 10_000, totalCents });
      const warned = invoiceDiscountWarning({ subtotalCents: 10_000, totalCents }) !== null;
      expect(flagged, `disagreed at ${totalCents}`).toBe(warned);
    }
  });
});
