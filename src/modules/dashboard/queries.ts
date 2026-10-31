import { prisma } from "@/lib/prisma";
import { lastNDays, isoFromBusinessDay, recentBusinessDays } from "@/lib/date";
import { safeDivide } from "@/lib/money";

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;

export async function getDashboard(params: {
  businessId: string;
  locationId: string;
  days?: number;
  eventId?: string | null;
  eventRange?: { start: Date; end: Date } | null;
  /** IANA zone the business trades in; the missing-close window is counted in it. */
  timezone?: string;
}) {
  const days = params.days ?? 14;
  const timezone = params.timezone ?? "UTC";
  const baseRange = lastNDays(days);
  const { from, to } = params.eventRange
    ? { from: params.eventRange.start, to: params.eventRange.end }
    : baseRange;

  const eventFilter = params.eventId ? { eventId: params.eventId } : {};

  const [sales, shifts, cashCloses, recentVariance, lowStock, openPos, ingredientsCount, business] = await Promise.all([
    prisma.dailySales.findMany({
      where: { locationId: params.locationId, businessDate: { gte: from, lte: to }, ...eventFilter },
      orderBy: { businessDate: "asc" },
    }),
    prisma.shift.findMany({
      where: { locationId: params.locationId, start: { gte: from, lte: to } },
      include: { employee: true, timeEntry: true },
    }),
    prisma.cashClose.findMany({
      where: { locationId: params.locationId, businessDate: { gte: from, lte: to }, ...eventFilter },
      orderBy: { businessDate: "desc" },
    }),
    prisma.inventoryCount.findFirst({
      where: { locationId: params.locationId },
      orderBy: { countedAt: "desc" },
      include: { lines: true },
    }),
    prisma.ingredient.findMany({
      where: { businessId: params.businessId },
      orderBy: { name: "asc" },
    }),
    prisma.purchaseOrder.findMany({
      where: { locationId: params.locationId, status: { in: ["DRAFT", "SENT"] } },
      include: { supplier: true, items: true },
      orderBy: { expectedAt: "asc" },
      take: 5,
    }),
    prisma.ingredient.count({ where: { businessId: params.businessId } }),
    prisma.business.findUnique({ where: { id: params.businessId } }),
  ]);

  const netSalesCents = sales.reduce((a, s) => a + s.netSalesCents, 0);
  const tipsCents = sales.reduce((a, s) => a + s.tipsCents, 0);
  const guestCount = sales.reduce((a, s) => a + s.guestCount, 0);

  // labor cost from completed time entries, fall back to scheduled minutes * rate
  const laborCostCents = shifts.reduce((acc, s) => {
    const minutes = s.timeEntry?.actualMinutes ?? s.scheduledMinutes;
    const cents = Math.round((minutes / 60) * s.employee.hourlyRateCents);
    return acc + cents;
  }, 0);

  // food cost (theoretical): sum of USAGE movements in window valued at avgCost
  // Fallback: when no USAGE rows exist (operator only enters invoices, no
  // recipe-driven sales), use invoice totals in the period instead — keyed
  // by invoiceDate and scoped to event when one is active.
  const [usage, invoicesForFood] = await Promise.all([
    prisma.inventoryMovement.findMany({
      where: { locationId: params.locationId, occurredAt: { gte: from, lte: to }, type: "USAGE" },
      include: { ingredient: { select: { avgCostCents: true } } },
    }),
    // When event-scoped, the eventId tag is more reliable than the invoice
    // date (suppliers are often invoiced before the event begins).
    prisma.invoice.findMany({
      where: params.eventId
        ? { locationId: params.locationId, OR: [{ eventId: params.eventId }, { appliesToAllEvents: true }] }
        : { locationId: params.locationId, invoiceDate: { gte: from, lte: to } },
      select: { totalCents: true, appliesToAllEvents: true },
    }),
  ]);
  const eventCountForShare = params.eventId ? await prisma.event.count({ where: { businessId: params.businessId } }) : 1;
  const theoreticalFoodCostCents = usage.reduce((acc, m) => acc + Math.round(Math.abs(m.qty) * m.ingredient.avgCostCents), 0);
  const shareDivFood = Math.max(1, eventCountForShare);
  const invoiceFoodCostCents = invoicesForFood.reduce(
    (a, i) => a + (params.eventId && i.appliesToAllEvents ? Math.round(i.totalCents / shareDivFood) : i.totalCents),
    0,
  );
  const foodCostCents = theoreticalFoodCostCents > 0 ? theoreticalFoodCostCents : invoiceFoodCostCents;
  const foodCostBasis: "usage" | "invoices" | "none" =
    theoreticalFoodCostCents > 0 ? "usage" : invoiceFoodCostCents > 0 ? "invoices" : "none";

  // inventory variance %: latest count's varianceCost / value of period sales
  const varianceCostCents = recentVariance ? recentVariance.lines.reduce((a, l) => a + Math.abs(l.varianceCostCents), 0) : 0;
  const varianceQtyAbsSum = recentVariance ? recentVariance.lines.reduce((a, l) => a + Math.abs(l.varianceQty), 0) : 0;
  const varianceTheoreticalSum = recentVariance ? recentVariance.lines.reduce((a, l) => a + Math.abs(l.theoreticalQty), 0) : 0;
  const inventoryVariancePct = safeDivide(varianceQtyAbsSum, varianceTheoreticalSum || 1) * 100;

  // cash over/short total
  const cashOverShortCents = cashCloses.reduce((a, c) => a + c.overShortCents, 0);

  // low stock items
  const lowStockItems = lowStock
    .filter((i) => i.onHand <= i.reorderPoint && i.reorderPoint > 0)
    .map((i) => ({ id: i.id, name: i.name, onHand: i.onHand, reorderPoint: i.reorderPoint, unit: i.unit }));

  /*
    Missing close: any of the last 7 business days without one.

    Both sides are plain YYYY-MM-DD now. This compared `startOfDay(storedDate)`
    against days generated from the server's own clock — stored dates are UTC
    midnight, so off a UTC server startOfDay moved them and every day in the
    window came back "missing". The window is also counted in the business's own
    timezone, so a market that ran last night is not reported as missed because
    the server has already rolled into tomorrow.
  */
  const closesByDay = new Set(cashCloses.map((c) => isoFromBusinessDay(c.businessDate)));
  const expectedDays = recentBusinessDays(timezone, 7);
  const missingCloseDays = expectedDays.filter((d) => !closesByDay.has(d));

  const foodPct = safeDivide(foodCostCents, netSalesCents) * 100;
  const laborPct = safeDivide(laborCostCents, netSalesCents) * 100;
  const primePct = foodPct + laborPct;

  const foodTarget = business?.foodTargetPct ?? 32;
  const laborTarget = business?.laborTargetPct ?? 30;

  return {
    period: { from, to, days },
    kpis: {
      netSalesCents,
      tipsCents,
      guestCount,
      foodCostCents,
      laborCostCents,
      foodPct,
      laborPct,
      primePct,
      inventoryVariancePct,
      varianceCostCents,
      cashOverShortCents,
      foodTarget,
      laborTarget,
      foodCostBasis,
    },
    lowStockItems,
    openPos,
    missingCloseDays,
    ingredientsCount,
    lastCountAt: recentVariance?.countedAt ?? null,
  };
}

/**
 * Net sales for the window of equal length immediately before `range`.
 *
 * The Overview's headline shows a change figure. "vs last season" isn't
 * derivable — the app has no season concept — so the comparison is against the
 * preceding stretch of the same length, and the label says exactly that.
 * Returns null when that earlier window has no sales at all, since a change
 * from zero is a meaningless percentage.
 */
export async function getPriorNetSales(
  locationId: string,
  range: { start: Date; end: Date },
): Promise<number | null> {
  const span = range.end.getTime() - range.start.getTime();
  const priorEnd = new Date(range.start.getTime() - 1);
  const priorStart = new Date(priorEnd.getTime() - span);
  const agg = await prisma.dailySales.aggregate({
    where: { locationId, businessDate: { gte: priorStart, lte: priorEnd } },
    _sum: { netSalesCents: true },
  });
  const cents = agg._sum.netSalesCents ?? 0;
  return cents > 0 ? cents : null;
}
