import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { businessDayFromIso, dayKeyInZone } from "@/lib/date";
import { addDaysIso } from "@/modules/square/aggregate";
import { SquareAuthError, type SquareClient, type SquareOrder } from "@/modules/square/client";
import { syncConnection, type SyncDeps } from "@/modules/square/sync";

/*
  The Square sync against a real database, with a fake Square account. What
  these check is what ends up in the tables: whole days rebuilt, hand-entered
  days left alone, events and categories kept, the cursor only ever moving
  forward once days are finished, and a revoked grant handled.

  A fake Square means these prove the code around Square's responses. They
  say nothing about whether Square's real responses look like the fake; only
  a real account can (see docs/SQUARE-SYNC.md, "first sync").

  Refuses to run against a database whose name does not contain "test".
*/

const url = process.env.DATABASE_URL ?? "";
const dbName = (() => { try { return decodeURIComponent(new URL(url).pathname.slice(1)); } catch { return ""; } })();
if (!/test/i.test(dbName)) {
  throw new Error(`Refusing to run against database "${dbName}". Point DATABASE_URL at one whose name contains "test".`);
}

const db = new PrismaClient();
const TZ = "America/Toronto";
const today = dayKeyInZone(new Date(), TZ);
const at = (iso: string, hour = 14) => new Date(`${iso}T${String(hour + 4).padStart(2, "0")}:00:00Z`).toISOString(); // ~local afternoon
const $ = (amount: number) => ({ amount, currency: "CAD" });

let n = 0;
function sale(day: string, over: Partial<SquareOrder> = {}): SquareOrder {
  return {
    id: `o${++n}`, state: "COMPLETED", closed_at: at(day),
    line_items: [{ name: "Masala Chai", quantity: "1", catalog_object_id: "var-chai", total_money: $(565), total_tax_money: $(65) }],
    tenders: [{ type: "CARD", amount_money: $(665) }],
    total_tip_money: $(100),
    ...over,
  };
}

function fakeSquare(orders: SquareOrder[], opts: { pageSize?: number; failWith?: Error } = {}) {
  const calls = { search: 0, categories: 0 };
  const client: SquareClient = {
    async merchant() { return { id: "M1", name: "God's Chai" }; },
    async locations() { return [{ id: "L1", name: "Stall", status: "ACTIVE", timezone: TZ, currency: "CAD" }]; },
    async searchOrders({ startAt, endAt, cursor }) {
      calls.search++;
      if (opts.failWith) throw opts.failWith;
      const inWindow = orders
        .filter((o) => { const t = new Date(o.closed_at!).getTime(); return t >= startAt.getTime() && t < endAt.getTime(); })
        .sort((a, b) => a.closed_at!.localeCompare(b.closed_at!));
      const size = opts.pageSize ?? 500;
      const from = cursor ? Number(cursor) : 0;
      const page = inWindow.slice(from, from + size);
      return { orders: page, cursor: from + size < inWindow.length ? String(from + size) : undefined };
    },
    async categoriesFor(ids) {
      calls.categories++;
      return new Map(ids.filter((i) => i === "var-chai").map((i) => [i, "Hot Chai"]));
    },
  };
  const deps: SyncDeps = { db, squareFor: async () => client };
  return { deps, calls };
}

let ids: { businessId: string; locationId: string; userId: string; connectionId: string };
const tag = () => Math.random().toString(36).slice(2, 8);

beforeAll(async () => { await db.$connect(); });

beforeEach(async () => {
  const t = tag();
  const b = await db.business.create({ data: { name: `Test Biz ${t}`, currency: "CAD", timezone: TZ } });
  const loc = await db.location.create({ data: { businessId: b.id, name: "Stall" } });
  const user = await db.user.create({ data: { email: `owner-${t}@test.invalid`, passwordHash: "x", name: "Owner", role: "OWNER", businessId: b.id } });
  const conn = await db.squareConnection.create({
    data: {
      businessId: b.id, locationId: loc.id, connectedById: user.id, merchantId: "M1", merchantName: "God's Chai",
      squareLocationIds: ["L1"], squareLocations: [{ id: "L1", name: "Stall" }], timezone: TZ,
      refreshTokenEnc: "v1.x.y.z", syncedThroughDay: addDaysIso(today, -10),
    },
  });
  ids = { businessId: b.id, locationId: loc.id, userId: user.id, connectionId: conn.id };
});

afterEach(async () => {
  await db.squareConnection.deleteMany({ where: { businessId: ids.businessId } });
  await db.salesItem.deleteMany({ where: { locationId: ids.locationId } });
  await db.dailySales.deleteMany({ where: { locationId: ids.locationId } });
  await db.cashClose.deleteMany({ where: { locationId: ids.locationId } });
  await db.event.deleteMany({ where: { businessId: ids.businessId } });
  await db.business.delete({ where: { id: ids.businessId } });
});

const sync = (deps: SyncDeps) => syncConnection(ids.connectionId, "manual", deps);
const dayRow = (iso: string) => db.dailySales.findUnique({ where: { locationId_businessDate: { locationId: ids.locationId, businessDate: businessDayFromIso(iso) } } });
const items = (iso: string) => db.salesItem.findMany({ where: { locationId: ids.locationId, businessDate: businessDayFromIso(iso) }, orderBy: { itemName: "asc" } });
const conn = () => db.squareConnection.findUniqueOrThrow({ where: { id: ids.connectionId } });

describe("syncing sales", () => {
  it("writes a day's totals and items, and gives new items Square's category", async () => {
    const d = addDaysIso(today, -2);
    const { deps } = fakeSquare([sale(d), sale(d), sale(d, { tenders: [{ type: "CASH", amount_money: $(665) }] })]);
    const r = await sync(deps);
    expect(r).toMatchObject({ ran: true, ordersRead: 3, daysWritten: 1, partial: false });

    expect(await dayRow(d)).toMatchObject({ netSalesCents: 1500, taxCents: 195, tipsCents: 300, guestCount: 3, source: "POS" });
    const [chai] = await items(d);
    expect(chai).toMatchObject({ itemName: "Masala Chai", qty: 3, netSalesCents: 1500, txCount: 3, category: "Hot Chai" });
  });

  it("gives the same answer when it runs twice", async () => {
    const d = addDaysIso(today, -1);
    const { deps } = fakeSquare([sale(d), sale(d)]);
    await sync(deps);
    await db.squareConnection.update({ where: { id: ids.connectionId }, data: { syncedThroughDay: addDaysIso(today, -10) } });
    await sync(deps);
    expect(await dayRow(d)).toMatchObject({ netSalesCents: 1000, guestCount: 2 });
    expect(await items(d)).toHaveLength(1);
  });

  it("reads every page Square returns", async () => {
    const d = addDaysIso(today, -3);
    const many = Array.from({ length: 23 }, () => sale(d));
    const { deps, calls } = fakeSquare(many, { pageSize: 5 });
    await sync(deps);
    expect((await dayRow(d))!.guestCount).toBe(23);
    expect(calls.search).toBeGreaterThanOrEqual(5);
  });
});

describe("premix", () => {
  const premixLine = (name: string | undefined, unit: number) => ({
    ...(name ? { name } : {}), quantity: "1", base_price_money: $(unit), total_money: $(unit), total_tax_money: $(0),
  });

  it("files $14.99 / $15.99 lines as Premix rows without changing the day's sales", async () => {
    const d = addDaysIso(today, -2);
    const { deps } = fakeSquare([
      sale(d),
      sale(d, { line_items: [premixLine("Original Masala", 1499)], tenders: [{ type: "CARD", amount_money: $(1499) }], total_tip_money: $(0) }),
      sale(d, { line_items: [premixLine(undefined, 1599)], tenders: [{ type: "CARD", amount_money: $(1599) }], total_tip_money: $(0) }),
    ]);
    await sync(deps);
    const rows = await items(d);
    expect(rows.filter((r) => r.category === "Premix").map((r) => r.itemName).sort()).toEqual(["Premix · Open amount $15.99", "Premix · Original Masala"]);
    expect(rows.find((r) => r.itemName === "Masala Chai")!.category).toBe("Hot Chai");
    // 500 for the cup + 1499 + 1599, and the item rows add up to the same.
    expect((await dayRow(d))!.netSalesCents).toBe(500 + 1499 + 1599);
    expect(rows.reduce((a, r) => a + r.netSalesCents, 0)).toBe(500 + 1499 + 1599);
  });

  it("keeps a category somebody chose for a premix row", async () => {
    const d = addDaysIso(today, -2);
    await db.salesItem.create({ data: { locationId: ids.locationId, businessDate: businessDayFromIso(d), itemName: "Premix · Rose", category: "Retail", qty: 0, netSalesCents: 0 } });
    const { deps } = fakeSquare([sale(d, { line_items: [premixLine("Rose", 1599)], tenders: [{ type: "CARD", amount_money: $(1599) }], total_tip_money: $(0) })]);
    await sync(deps);
    expect((await items(d)).find((r) => r.itemName === "Premix · Rose")!.category).toBe("Retail");
  });
});

describe("what it leaves alone", () => {
  it("never overwrites a day typed in by hand, and says which", async () => {
    const d = addDaysIso(today, -4);
    await db.dailySales.create({ data: { locationId: ids.locationId, businessDate: businessDayFromIso(d), netSalesCents: 99_900, source: "MANUAL" } });
    const { deps } = fakeSquare([sale(d)]);
    const r = await sync(deps);
    expect(r.manualDaysKept).toEqual([d]);
    expect(await dayRow(d)).toMatchObject({ netSalesCents: 99_900, source: "MANUAL" });
  });

  it("replaces a day that came from a CSV, removing item rows Square doesn't have", async () => {
    const d = addDaysIso(today, -5);
    const date = businessDayFromIso(d);
    await db.dailySales.create({ data: { locationId: ids.locationId, businessDate: date, netSalesCents: 1, source: "POS" } });
    await db.salesItem.create({ data: { locationId: ids.locationId, businessDate: date, itemName: "Masala Chai - Large", qty: 1, netSalesCents: 1 } });
    const { deps } = fakeSquare([sale(d)]);
    await sync(deps);
    expect((await dayRow(d))!.netSalesCents).toBe(500);
    expect((await items(d)).map((i) => i.itemName)).toEqual(["Masala Chai"]);
  });

  it("keeps a category someone chose over Square's", async () => {
    const d = addDaysIso(today, -2);
    await db.salesItem.create({ data: { locationId: ids.locationId, businessDate: businessDayFromIso(d), itemName: "Masala Chai", category: "Cold Chais", qty: 0, netSalesCents: 0 } });
    const { deps } = fakeSquare([sale(d)]);
    await sync(deps);
    expect((await items(d))[0].category).toBe("Cold Chais");
  });

  it("only fills in the card side of an existing cash close, never the count", async () => {
    const d = addDaysIso(today, -2);
    await db.cashClose.create({
      data: {
        locationId: ids.locationId, businessDate: businessDayFromIso(d), openingCents: 10_000, closingCents: 10_000,
        cashCents: 10_000, expectedCents: 0, overShortCents: 0, closedById: ids.userId,
      },
    });
    const { deps } = fakeSquare([sale(d)]);
    await sync(deps);
    const close = await db.cashClose.findFirstOrThrow({ where: { locationId: ids.locationId } });
    expect(close).toMatchObject({ cashCents: 10_000, creditCents: 665, expectedCents: 500 });
  });
});

describe("events", () => {
  it("tags a day to the one event covering it, and keeps a tag someone chose", async () => {
    const d1 = addDaysIso(today, -3);
    const d2 = addDaysIso(today, -2);
    const mela = await db.event.create({ data: { businessId: ids.businessId, name: "Diwali Mela", startDate: businessDayFromIso(d1), endDate: businessDayFromIso(d2) } });
    const other = await db.event.create({ data: { businessId: ids.businessId, name: "Catering", startDate: businessDayFromIso(today), endDate: businessDayFromIso(today) } });
    await db.dailySales.create({ data: { locationId: ids.locationId, businessDate: businessDayFromIso(d2), netSalesCents: 0, source: "POS", eventId: other.id } });

    const { deps } = fakeSquare([sale(d1), sale(d2)]);
    await sync(deps);
    expect((await dayRow(d1))!.eventId).toBe(mela.id);
    expect((await dayRow(d2))!.eventId).toBe(other.id);
    expect((await items(d1))[0].eventId).toBe(mela.id);
  });

  it("gives a day the event its cash close was tagged with, even when no event's dates cover it", async () => {
    const d = addDaysIso(today, -1);
    const market = await db.event.create({ data: { businessId: ids.businessId, name: "Comfy & Cozy Market", startDate: businessDayFromIso(addDaysIso(today, -30)), endDate: businessDayFromIso(addDaysIso(today, -29)) } });
    await db.cashClose.create({
      data: {
        locationId: ids.locationId, businessDate: businessDayFromIso(d), openingCents: 0, closingCents: 0,
        cashCents: 0, expectedCents: 0, overShortCents: 0, closedById: ids.userId, eventId: market.id,
      },
    });
    const { deps } = fakeSquare([sale(d)]);
    await sync(deps);
    expect((await dayRow(d))!.eventId).toBe(market.id);
    expect((await items(d))[0].eventId).toBe(market.id);
  });

  it("leaves a day untagged when two events overlap it", async () => {
    const d = addDaysIso(today, -2);
    for (const name of ["A", "B"]) {
      await db.event.create({ data: { businessId: ids.businessId, name, startDate: businessDayFromIso(d), endDate: businessDayFromIso(d) } });
    }
    const { deps } = fakeSquare([sale(d)]);
    await sync(deps);
    expect((await dayRow(d))!.eventId).toBeNull();
  });
});

describe("its place", () => {
  it("moves forward to today once the days before it are finished", async () => {
    const { deps } = fakeSquare([]);
    const r = await sync(deps);
    expect(r.syncedThroughDay).toBe(today);
    expect((await conn()).syncedThroughDay).toBe(today);
  });

  it("does not move when Square fails, and records the problem", async () => {
    const { deps } = fakeSquare([], { failWith: new Error("Square /orders/search failed: INTERNAL_SERVER_ERROR") });
    const r = await sync(deps);
    expect(r.error).toMatch(/INTERNAL_SERVER_ERROR/);
    const c = await conn();
    expect(c.syncedThroughDay).toBe(addDaysIso(today, -10));
    expect(c.runningSince).toBeNull();
    expect(c.status).toBe("ACTIVE");
  });

  it("marks the connection for reconnecting when Square refuses the grant", async () => {
    const { deps } = fakeSquare([], { failWith: new SquareAuthError("Square refused the request (UNAUTHORIZED).") });
    await sync(deps);
    const c = await conn();
    expect(c.status).toBe("NEEDS_RECONNECT");
    // A connection needing reconnecting is not run again until it is.
    expect((await sync(fakeSquare([]).deps)).ran).toBe(false);
  });

  it("never runs twice at once", async () => {
    await db.squareConnection.update({ where: { id: ids.connectionId }, data: { runningSince: new Date() } });
    const r = await sync(fakeSquare([sale(addDaysIso(today, -1))]).deps);
    expect(r.ran).toBe(false);
  });

  it("fills a long history in week-sized chunks, saving its place after each", async () => {
    await db.squareConnection.update({ where: { id: ids.connectionId }, data: { syncedThroughDay: addDaysIso(today, -60) } });
    const orders = [addDaysIso(today, -58), addDaysIso(today, -30), addDaysIso(today, -1)].map((d) => sale(d));
    const { deps, calls } = fakeSquare(orders);
    const r = await sync(deps);
    expect(r).toMatchObject({ daysWritten: 3, partial: false, syncedThroughDay: today });
    expect(calls.search).toBeGreaterThanOrEqual(8); // ~63 days / 7
  });
});
