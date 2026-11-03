import { describe, expect, it } from "vitest";
import { addDaysIso, aggregateOrders, cents, CUSTOM_AMOUNT, startOfDayInZone } from "@/modules/square/aggregate";
import type { SquareOrder } from "@/modules/square/client";

/*
  What a day's Square numbers ARE. These pin the definitions to Square's own
  Sales Summary: net is after discounts and before tax and tips, refunds land
  on the day they were made, a refund is not a sale, and an order belongs to
  the day it closed where the stall is, not in UTC.
*/

const TZ = "America/Toronto";
const $ = (amount: number, currency = "CAD") => ({ amount, currency });

let n = 0;
function order(over: Partial<SquareOrder> = {}): SquareOrder {
  return {
    id: `o${++n}`,
    state: "COMPLETED",
    closed_at: "2026-10-04T18:00:00Z", // 2pm in Toronto
    line_items: [{ name: "Masala Chai", quantity: "2", catalog_object_id: "var-chai", total_money: $(1130), total_tax_money: $(130) }],
    tenders: [{ type: "CARD", amount_money: $(1330) }],
    total_tip_money: $(200),
    ...over,
  };
}

describe("aggregateOrders", () => {
  it("nets out tax, keeps tips separate, and counts one sale", () => {
    const { days } = aggregateOrders([order()], TZ, "CAD");
    const d = days.get("2026-10-04")!;
    expect(d).toMatchObject({ sales: 1, netCents: 1000, taxCents: 130, tipsCents: 200, cardCents: 1330, cashCents: 0 });
    expect(d.items.get("Masala Chai")).toMatchObject({ qty: 2, netCents: 1000, taxCents: 130, txCount: 1 });
  });

  it("files a late-evening sale on that evening, not on the next UTC day", () => {
    // 11:30pm in Toronto is 03:30 the next day in UTC.
    const { days } = aggregateOrders([order({ closed_at: "2026-10-05T03:30:00Z" })], TZ, "CAD");
    expect([...days.keys()]).toEqual(["2026-10-04"]);
  });

  it("splits tenders into card, cash and other", () => {
    const { days } = aggregateOrders([
      order({ tenders: [{ type: "CASH", amount_money: $(500) }, { type: "CARD", amount_money: $(830) }] }),
      order({ tenders: [{ type: "SQUARE_GIFT_CARD", amount_money: $(1330) }] }),
    ], TZ, "CAD");
    expect(days.get("2026-10-04")).toMatchObject({ cashCents: 500, cardCents: 830, otherCents: 1330, sales: 2 });
  });

  it("subtracts a refund on the day it was made, and does not count it as a sale", () => {
    const sale = order({ closed_at: "2026-10-04T18:00:00Z" });
    const refund = order({
      closed_at: "2026-10-06T15:00:00Z",
      line_items: [],
      tenders: [],
      total_tip_money: $(0),
      returns: [{ return_line_items: [{ name: "Masala Chai", quantity: "1", total_money: $(565), total_tax_money: $(65) }] }],
      return_amounts: { tip_money: $(100) },
    });
    const { days } = aggregateOrders([sale, refund], TZ, "CAD");
    expect(days.get("2026-10-04")).toMatchObject({ netCents: 1000, sales: 1 });
    const later = days.get("2026-10-06")!;
    expect(later).toMatchObject({ netCents: -500, taxCents: -65, tipsCents: -100, sales: 0 });
    // The refunded day's item row carries the negative, so its items still sum to its total.
    expect(later.items.get("Masala Chai")).toMatchObject({ qty: -1, netCents: -500 });
  });

  it("drops an item sold and fully refunded the same day", () => {
    const sale = order();
    const refund = order({
      line_items: [], tenders: [], total_tip_money: $(0),
      returns: [{ return_line_items: [{ name: "Masala Chai", quantity: "2", total_money: $(1130), total_tax_money: $(130) }] }],
    });
    const d = aggregateOrders([sale, refund], TZ, "CAD").days.get("2026-10-04")!;
    expect(d.netCents).toBe(0);
    expect(d.items.has("Masala Chai")).toBe(false);
  });

  it("names an unnamed line the way Square does", () => {
    const d = aggregateOrders([order({ line_items: [{ quantity: "1", total_money: $(800), total_tax_money: $(0) }] })], TZ, "CAD").days.get("2026-10-04")!;
    expect(d.items.get(CUSTOM_AMOUNT)).toMatchObject({ qty: 1, netCents: 800 });
  });

  it("adds up variations of one item under the item, counting each sale once", () => {
    const d = aggregateOrders([order({
      line_items: [
        { name: "Masala Chai", quantity: "1", catalog_object_id: "var-small", total_money: $(400), total_tax_money: $(0) },
        { name: "Masala Chai", quantity: "1", catalog_object_id: "var-large", total_money: $(600), total_tax_money: $(0) },
      ],
    })], TZ, "CAD").days.get("2026-10-04")!;
    const chai = d.items.get("Masala Chai")!;
    expect(chai).toMatchObject({ qty: 2, netCents: 1000, txCount: 1 });
    expect([...chai.variationIds].sort()).toEqual(["var-large", "var-small"]);
  });

  it("never adds a sale in another currency — leaves it out and counts it", () => {
    const r = aggregateOrders([order(), order({
      line_items: [{ name: "Chai", quantity: "1", total_money: $(500, "USD"), total_tax_money: $(0, "USD") }],
      tenders: [{ type: "CARD", amount_money: $(500, "USD") }],
    })], TZ, "CAD");
    expect(r.foreignCurrency).toBe(1);
    expect(r.days.get("2026-10-04")!.netCents).toBe(1000);
  });

  it("ignores orders that are not completed or never closed", () => {
    const r = aggregateOrders([order({ state: "OPEN" }), order({ state: "CANCELED" }), order({ closed_at: null })], TZ, "CAD");
    expect(r.days.size).toBe(0);
  });

  it("reads amounts sent as strings and treats junk as zero", () => {
    expect(cents({ amount: "1250" })).toBe(1250);
    expect(cents({ amount: "abc" })).toBe(0);
    expect(cents(null)).toBe(0);
  });
});

describe("days in a timezone", () => {
  it("finds local midnight, across both DST changes", () => {
    expect(startOfDayInZone("2026-07-01", TZ).toISOString()).toBe("2026-07-01T04:00:00.000Z"); // EDT
    expect(startOfDayInZone("2026-12-01", TZ).toISOString()).toBe("2026-12-01T05:00:00.000Z"); // EST
    expect(startOfDayInZone("2026-03-08", TZ).toISOString()).toBe("2026-03-08T05:00:00.000Z"); // spring forward is at 2am, after midnight
    expect(startOfDayInZone("2026-11-01", TZ).toISOString()).toBe("2026-11-01T04:00:00.000Z"); // fall back
    expect(startOfDayInZone("2026-10-04", "Asia/Kolkata").toISOString()).toBe("2026-10-03T18:30:00.000Z");
  });

  it("steps calendar days across month and year ends", () => {
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysIso("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("premix", () => {
  const line = (name: string | undefined, unit: number, qty = 1, taxPct = 0.13) => ({
    ...(name ? { name } : {}),
    quantity: String(qty),
    base_price_money: $(unit),
    total_money: $(Math.round(unit * qty * (1 + taxPct))),
    total_tax_money: $(Math.round(unit * qty * taxPct)),
  });
  const o = (lines: ReturnType<typeof line>[], over: Partial<SquareOrder> = {}) =>
    order({ line_items: lines, tenders: [{ type: "CARD", amount_money: $(5000) }], total_tip_money: $(0), ...over });

  it("files $14.99 and $15.99 lines under their own premix rows and category", () => {
    const d = aggregateOrders([o([line("Original Masala", 1499), line("Rose", 1599, 2), line(undefined, 1499)])], TZ, "CAD").days.get("2026-10-04")!;
    expect(d.items.get("Premix · Original Masala")).toMatchObject({ qty: 1, category: "Premix" });
    expect(d.items.get("Premix · Rose")).toMatchObject({ qty: 2, category: "Premix" });
    expect(d.items.get("Premix · Open amount $14.99")).toMatchObject({ qty: 1, category: "Premix" });
    // Not merged into the generic open-amount row.
    expect(d.items.has(CUSTOM_AMOUNT)).toBe(false);
  });

  it("keeps cups of the same flavour, and other open amounts, where they were", () => {
    const d = aggregateOrders([o([line("Original Masala", 550), line(undefined, 800), line("Original Masala", 1499)])], TZ, "CAD").days.get("2026-10-04")!;
    expect(d.items.get("Original Masala")).toMatchObject({ qty: 1 });
    expect(d.items.get("Original Masala")!.category).toBeUndefined();
    expect(d.items.get(CUSTOM_AMOUNT)).toMatchObject({ qty: 1 });
    expect(d.items.get("Premix · Original Masala")).toMatchObject({ qty: 1 });
  });

  it("does not change the day's totals: premix is the same money, shown apart", () => {
    const lines = [line("Original Masala", 550, 1, 0), line("Original Masala", 1499, 1, 0), line("Rose", 1599, 1, 0)];
    const split = aggregateOrders([o(lines)], TZ, "CAD").days.get("2026-10-04")!;
    const sum = [...split.items.values()].reduce((a, i) => a + i.netCents, 0);
    expect(sum).toBe(split.netCents);
    expect(split.netCents).toBe(550 + 1499 + 1599);
  });

  it("matches on the price before tax, so tax rates do not matter", () => {
    const d = aggregateOrders([o([line("Cardamom", 1499, 1, 0.05), line("Cardamom", 1499, 1, 0.13)])], TZ, "CAD").days.get("2026-10-04")!;
    expect(d.items.get("Premix · Cardamom")).toMatchObject({ qty: 2 });
  });

  it("nets a premix refund against the premix row", () => {
    const sale = o([line("Rose", 1599)]);
    const refund = order({
      closed_at: "2026-10-04T20:00:00Z", line_items: [], tenders: [], total_tip_money: $(0),
      returns: [{ return_line_items: [line("Rose", 1599)] }],
    });
    const d = aggregateOrders([sale, refund], TZ, "CAD").days.get("2026-10-04")!;
    expect(d.items.has("Premix · Rose")).toBe(false); // sold and refunded the same day
    expect(d.netCents).toBe(0);
  });
});
