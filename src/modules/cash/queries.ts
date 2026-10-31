import { prisma } from "@/lib/prisma";
import { lastNDays, businessDayFromIso } from "@/lib/date";

export async function listCashCloses(locationId: string, days = 30, eventId?: string | null) {
  const { from, to } = lastNDays(days);
  return prisma.cashClose.findMany({
    where: {
      locationId,
      businessDate: { gte: from, lte: to },
      ...(eventId ? { eventId } : {}),
    },
    include: {
      closedBy: { select: { name: true } },
      verifiedBy: { select: { name: true } },
      event: { select: { id: true, name: true, color: true } },
    },
    orderBy: { businessDate: "desc" },
  });
}

export async function getCashCloseByDate(locationId: string, isoDate: string) {
  return prisma.cashClose.findFirst({
    where: { locationId, businessDate: businessDayFromIso(isoDate) },
    include: {
      closedBy: { select: { name: true } },
      verifiedBy: { select: { name: true } },
    },
  });
}

export async function getSalesForDate(locationId: string, isoDate: string) {
  return prisma.dailySales.findFirst({
    where: { locationId, businessDate: businessDayFromIso(isoDate) },
  });
}

export async function listDepositsForDate(locationId: string, isoDate: string) {
  return prisma.deposit.findMany({
    where: { locationId, businessDate: businessDayFromIso(isoDate) },
    orderBy: { sequence: "asc" },
  });
}

/**
 * The most recent payouts, newest first.
 *
 * Bounded. /cash asked for a ten-year window, which is every payout a business
 * has ever recorded, and then rendered the whole array TWICE — once for the
 * desktop table and once for the mobile list. A daily trader passes a thousand
 * rows inside three years, none of which anyone scrolls to.
 *
 * The total beside the list does NOT come from here: getCashPosition sums it in
 * the database, so capping the list cannot make the figure wrong.
 */
export async function listPayouts(locationId: string, limit = 50) {
  return prisma.cashPayout.findMany({
    where: { locationId },
    orderBy: [{ businessDate: "desc" }, { createdAt: "asc" }],
    take: limit,
  });
}

export async function listPayoutsForDate(locationId: string, isoDate: string) {
  return prisma.cashPayout.findMany({
    where: { locationId, businessDate: businessDayFromIso(isoDate) },
    orderBy: { createdAt: "asc" },
  });
}

/*
  The cash position: how much cash the business is actually holding, across
  every event it has ever traded.

  Not the latest drawer count, which is what this used to be. This business
  trades at events with weeks of nothing between them, so "the most recent
  close" answered a question about one market day rather than about the cash
  box — and a thirty-day window could easily contain no trading at all.

  Per close the arithmetic is unchanged, and is the same one the tile has
  always claimed: the till as counted, less the float that was put in to make
  change. Banked cash and payouts are NOT taken off again — both left the
  drawer before it was counted, so they are already missing from the count.
  Subtracting them here would deduct the same money twice.

  A close with a zero count is left out rather than counted as minus the
  float. A till that was counted always has at least the float in it, so zero
  means nobody counted it — usually an entry saved with the amount left at its
  default. Counting those would quietly drag the total down by the float for
  every one of them. They are returned as `uncounted` so the page can say how
  many were skipped instead of hiding the gap.
*/
export async function getCashPosition(locationId: string) {
  /*
    Aggregated in the database, not in Node.

    This used to `findMany` every CashClose a location had ever recorded — all
    six columns of each — and then reduce the lot down to five scalars. The rows
    were never shown; they were summed and thrown away. A customer three years
    in was reading their entire history on every visit to /cash, and the page
    got measurably slower every season they stayed.

    SUM(cash) - SUM(opening) over the counted rows is the same number as
    SUM(cash - opening), which is what lets this be an aggregate at all.

    Five queries, all covered by the (locationId, businessDate) index, and the
    cost no longer grows with tenure.
  */
  const countedWhere = { locationId, cashCents: { gt: 0 } };

  const [counted, everything, paidOut, byKind, newest, oldest] = await Promise.all([
    prisma.cashClose.aggregate({
      where: countedWhere,
      _sum: { cashCents: true, openingCents: true },
      _count: true,
    }),
    prisma.cashClose.aggregate({
      where: { locationId },
      _sum: { depositCents: true, overShortCents: true },
      _count: true,
    }),
    prisma.cashPayout.aggregate({
      where: { locationId },
      _sum: { amountCents: true },
      _count: true,
    }),
    /*
      The same total, split by what the money was for.

      Every payout already records its kind, and nothing ever added them up —
      so reimbursing somebody who bought cups on their own card sat in one
      undifferentiated "Paid out" figure next to cash handed straight to a
      supplier. They leave the till the same way and belong in the same
      reconciliation, but they are not the same thing to look at: one is money
      owed to a person and settled, the other is a purchase.

      Grouped rather than three aggregates, so a kind added later needs no
      query.
    */
    prisma.cashPayout.groupBy({
      by: ["kind"],
      where: { locationId },
      _sum: { amountCents: true },
      _count: true,
    }),
    // The float and safe count belong to the most recent counted till, not to
    // the most recent close — an uncounted entry has neither.
    prisma.cashClose.findFirst({
      where: countedWhere,
      orderBy: { businessDate: "desc" },
      select: { businessDate: true, openingCents: true, safeCountCents: true },
    }),
    prisma.cashClose.findFirst({
      where: countedWhere,
      orderBy: { businessDate: "asc" },
      select: { businessDate: true },
    }),
  ]);

  return {
    inHandCents: (counted._sum.cashCents ?? 0) - (counted._sum.openingCents ?? 0),
    countedTills: counted._count,
    uncounted: everything._count - counted._count,
    closes: everything._count,
    // The float is working change rather than takings, so it is netted out of
    // the figure above — but it is real cash in the box, so it is named.
    floatCents: newest?.openingCents ?? 0,
    safeCents: newest?.safeCountCents ?? 0,
    bankedCents: everything._sum.depositCents ?? 0,
    paidOutCents: paidOut._sum.amountCents ?? 0,
    payoutCount: paidOut._count,
    paidOutByKind: byKind
      .map((k) => ({
        kind: k.kind,
        amountCents: k._sum.amountCents ?? 0,
        count: k._count,
      }))
      .sort((a, b) => b.amountCents - a.amountCents),
    overShortCents: everything._sum.overShortCents ?? 0,
    // The earliest till that was actually counted, not the earliest close —
    // the figure covers the counted ones, so that is the date it runs from.
    firstCountedDate: oldest?.businessDate ?? null,
    lastCountedDate: newest?.businessDate ?? null,
  };
}
