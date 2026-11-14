import { describe, expect, it } from "vitest";
import { filterPremixRows, summarisePremix, type PremixRow } from "@/modules/sales/premix-summary";

const rows: PremixRow[] = [
  { item: "Premix · Rose", date: "2026-11-01", eventId: "e1", qty: 2, netSalesCents: 2998 },
  { item: "Premix · Original Masala", date: "2026-11-01", eventId: "e1", qty: 1, netSalesCents: 1599 },
  { item: "Premix · Rose", date: "2026-11-08", eventId: "e2", qty: 3, netSalesCents: 4497 },
  { item: "Premix · Rose", date: "2026-11-10", eventId: null, qty: 1, netSalesCents: 1499 },
];

describe("premix filters", () => {
  it("adds up everything with no filter", () => {
    const s = summarisePremix(filterPremixRows(rows, { eventId: "all" }), 600)!;
    expect(s.qty).toBe(7);
    expect(s.netSalesCents).toBe(10593);
    expect(s.profitCents).toBe(10593 - 4200);
    expect(s.days).toBe(3);
    expect(s.events).toBe(2);
    expect(s.flavours[0].name).toBe("Rose");
  });
  it("filters by event", () => {
    const s = summarisePremix(filterPremixRows(rows, { eventId: "e1" }), 600)!;
    expect(s.qty).toBe(3);
    expect(s.days).toBe(1);
  });
  it("filters untagged rows", () => {
    expect(filterPremixRows(rows, { eventId: "none" })).toHaveLength(1);
  });
  it("filters by date sold, inclusive", () => {
    const r = filterPremixRows(rows, { eventId: "all", from: "2026-11-08", to: "2026-11-10" });
    expect(r.map((x) => x.date)).toEqual(["2026-11-08", "2026-11-10"]);
  });
  it("combines event and date, and returns null when nothing matches", () => {
    expect(summarisePremix(filterPremixRows(rows, { eventId: "e1", from: "2026-11-05" }), 600)).toBeNull();
  });
});

import { dayStartInstant } from "@/lib/date";
describe("dayStartInstant", () => {
  it("is local midnight in the business timezone", () => {
    // 02:30 UTC on Nov 14 is 21:30 on Nov 13 in New York (EST, UTC-5).
    expect(dayStartInstant("America/New_York", new Date("2026-11-14T02:30:00Z")).toISOString()).toBe("2026-11-13T05:00:00.000Z");
    expect(dayStartInstant("UTC", new Date("2026-11-14T02:30:00Z")).toISOString()).toBe("2026-11-14T00:00:00.000Z");
  });
});
