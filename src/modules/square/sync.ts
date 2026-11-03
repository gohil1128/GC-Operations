import type { Prisma, PrismaClient, SquareConnection } from "@prisma/client";
import { businessDayFromIso, dayKeyInZone } from "@/lib/date";
import { APP_CURRENCY } from "@/lib/money";
import { applySquareToClose } from "@/modules/cash/square-close";
import { addDaysIso, aggregateOrders, startOfDayInZone, type DayTotals } from "./aggregate";
import { SquareAuthError, type SquareClient, type SquareOrder } from "./client";

/*
  The sync: read Square's completed orders and write them as the app's daily
  sales and per-item rows.

  WHOLE DAYS, ALWAYS. Each day touched is rebuilt from every order Square has
  for it, never incremented. Running it twice, or over a day already imported
  from a CSV, gives the same answer as running it once. There is no "was this
  order counted yet" to get wrong.

  WHAT IT LEAVES ALONE
    - A day whose sales were typed in by hand (source MANUAL). Square would
      know better in most cases, but replacing what a person entered without
      them asking is how numbers stop being trusted; the card lists these days
      so the owner can decide.
    - An event someone tagged a day with. A day nobody tagged is tagged to the
      event whose dates cover it, when exactly one does.
    - A category someone gave an item. New items get Square's category.
    - The cash count on a close. See applySquareToClose.

  HOW FAR BACK
    Every run re-reads a few days behind where the last one finished, because
    Square can still change a recent day: offline payments upload late, and a
    catering invoice is filed when it is paid. Past that it reads forward in
    week-long chunks, saving its place after each, and stops starting new
    chunks when its time budget runs out, so a year of history fills in over a
    few runs instead of timing out on the first.
*/

export const OVERLAP_DAYS = 3;
export const CHUNK_DAYS = 7;
export const RUN_BUDGET_MS = 35_000;
export const RUN_LOCK_MS = 10 * 60_000;
/** The furthest back "Import history" may reach. */
export const MAX_HISTORY_DAYS = 400;
export const INITIAL_LOOKBACK_DAYS = 30;

type Db = PrismaClient;

export type SyncDeps = {
  db: Db;
  squareFor: (c: SquareConnection) => Promise<SquareClient>;
  now?: () => Date;
};

export type SyncResult = {
  ran: boolean;
  note?: string;
  ordersRead: number;
  daysWritten: number;
  /** Days with sales typed in by hand, left as they were. */
  manualDaysKept: string[];
  foreignCurrency: number;
  partial: boolean;
  syncedThroughDay?: string;
  error?: string;
};

const empty = (over: Partial<SyncResult> = {}): SyncResult => ({
  ran: false, ordersRead: 0, daysWritten: 0, manualDaysKept: [], foreignCurrency: 0, partial: false, ...over,
});

export async function syncConnection(connectionId: string, trigger: "cron" | "manual", deps: SyncDeps): Promise<SyncResult> {
  const now = deps.now ?? (() => new Date());
  const startedAt = now();
  const { db } = deps;

  // Claim the connection, or find another run already has it.
  const claimed = await db.squareConnection.updateMany({
    where: {
      id: connectionId,
      status: "ACTIVE",
      OR: [{ runningSince: null }, { runningSince: { lt: new Date(startedAt.getTime() - RUN_LOCK_MS) } }],
    },
    data: { runningSince: startedAt },
  });
  if (claimed.count === 0) return empty({ note: "Another sync is already running, or Square needs reconnecting." });

  const conn = await db.squareConnection.findUniqueOrThrow({ where: { id: connectionId } });
  const result = empty({ ran: true });

  try {
    if (conn.squareLocationIds.length === 0) {
      result.note = "No Square location is selected.";
      return result;
    }

    const client = await deps.squareFor(conn);
    const tz = conn.timezone;
    const today = dayKeyInZone(startedAt, tz);
    const events = await db.event.findMany({
      where: { businessId: conn.businessId },
      select: { id: true, startDate: true, endDate: true },
    });
    const categoryCache = new Map<string, string>();

    let from = addDaysIso(conn.syncedThroughDay, -OVERLAP_DAYS);
    let through = conn.syncedThroughDay;

    while (from <= today) {
      if (now().getTime() - startedAt.getTime() > RUN_BUDGET_MS) { result.partial = true; break; }

      const toExclusive = addDaysIso(from, CHUNK_DAYS) > addDaysIso(today, 1) ? addDaysIso(today, 1) : addDaysIso(from, CHUNK_DAYS);
      const startAt = startOfDayInZone(from, tz);
      const endAt = new Date(Math.min(startOfDayInZone(toExclusive, tz).getTime(), startedAt.getTime()));

      const orders: SquareOrder[] = [];
      let cursor: string | undefined;
      do {
        const page = await client.searchOrders({ locationIds: conn.squareLocationIds, startAt, endAt, cursor });
        orders.push(...page.orders);
        cursor = page.cursor;
      } while (cursor);
      result.ordersRead += orders.length;

      const { days, foreignCurrency } = aggregateOrders(orders, tz, APP_CURRENCY);
      result.foreignCurrency += foreignCurrency;

      // Categories are a nicety: a catalog that cannot be read never stops sales landing.
      const unknown = [...days.values()].flatMap((d) => [...d.items.values()].flatMap((i) => [...i.variationIds])).filter((id) => !categoryCache.has(id));
      if (unknown.length) {
        try {
          for (const [k, v] of await client.categoriesFor(unknown)) categoryCache.set(k, v);
        } catch (e) {
          if (e instanceof SquareAuthError) throw e;
        }
      }

      for (const d of [...days.values()].sort((a, b) => a.day.localeCompare(b.day))) {
        if (d.day < from || d.day >= toExclusive) continue; // an order just over a boundary belongs to the neighbouring chunk
        const outcome = await db.$transaction((tx) => writeDay(tx, conn, d, events, categoryCache));
        if (outcome === "manual") result.manualDaysKept.push(d.day);
        else result.daysWritten++;
      }

      // Days before today are final once read in full; today stays open.
      const done = toExclusive > today ? today : toExclusive;
      if (done > through) {
        through = done;
        await db.squareConnection.update({ where: { id: conn.id }, data: { syncedThroughDay: through } });
      }
      from = toExclusive;
    }
    result.syncedThroughDay = through;
    return result;
  } catch (e) {
    if (e instanceof SquareAuthError) {
      await db.squareConnection.update({
        where: { id: conn.id },
        data: { status: "NEEDS_RECONNECT", statusNote: "Square stopped accepting the saved permission. Reconnect to resume syncing." },
      });
      result.error = "Square needs reconnecting.";
    } else {
      console.error("[square] sync failed:", e instanceof Error ? e.message : e);
      result.error = e instanceof Error ? e.message.slice(0, 200) : "Sync failed.";
    }
    return result;
  } finally {
    await db.squareConnection.update({
      where: { id: conn.id },
      data: {
        runningSince: null,
        lastSyncAt: now(),
        lastResult: { ...result, trigger, at: now().toISOString() } as unknown as Prisma.InputJsonValue,
      },
    });
  }
}

/** Rebuild one business day from Square's totals. */
async function writeDay(
  tx: Prisma.TransactionClient,
  conn: SquareConnection,
  d: DayTotals,
  events: { id: string; startDate: Date; endDate: Date }[],
  categories: Map<string, string>,
): Promise<"written" | "manual"> {
  const locationId = conn.locationId;
  const businessDate = businessDayFromIso(d.day);
  const existing = await tx.dailySales.findUnique({ where: { locationId_businessDate: { locationId, businessDate } } });
  if (existing?.source === "MANUAL") return "manual";

  const covering = events.filter((e) => e.startDate <= businessDate && businessDate <= e.endDate);
  const eventId = existing?.eventId ?? (covering.length === 1 ? covering[0].id : null);

  const day = {
    netSalesCents: d.netCents,
    taxCents: d.taxCents,
    tipsCents: d.tipsCents,
    guestCount: d.sales, // one sale = one guest, the convention used everywhere else
    eventId,
    source: "POS" as const,
  };
  await tx.dailySales.upsert({
    where: { locationId_businessDate: { locationId, businessDate } },
    create: { locationId, businessDate, ...day },
    update: day,
  });

  const before = await tx.salesItem.findMany({ where: { locationId, businessDate }, select: { id: true, itemName: true, category: true } });
  const byName = new Map(before.map((i) => [i.itemName, i]));
  for (const i of d.items.values()) {
    const prior = byName.get(i.name);
    // Premix is filed under its own category whatever Square calls the item; a
    // category somebody chose by hand still wins (prior, below).
    const squareCategory = i.category ?? [...i.variationIds].map((v) => categories.get(v)).find(Boolean) ?? null;
    const data = {
      category: prior?.category ?? squareCategory,
      qty: i.qty,
      netSalesCents: i.netCents,
      taxCents: i.taxCents,
      txCount: i.txCount,
      eventId,
    };
    if (prior) await tx.salesItem.update({ where: { id: prior.id }, data });
    else await tx.salesItem.create({ data: { locationId, businessDate, itemName: i.name, ...data } });
  }
  // Rows Square no longer has for this day (an item renamed, or a CSV that
  // split items differently) would double-count against the new ones.
  const stale = before.filter((b) => !d.items.has(b.itemName)).map((b) => b.id);
  if (stale.length) await tx.salesItem.deleteMany({ where: { id: { in: stale } } });

  await applySquareToClose(tx, { locationId, businessDate, netCents: d.netCents, cardCents: d.cardCents });
  return "written";
}
