import { prisma } from "@/lib/prisma";
import { splitInvoiceCosts } from "./cost-classes";
import { lastNDays, dayRange, fmtDate, startOfDay } from "@/lib/date";
import { safeDivide } from "@/lib/money";

export async function dailySummary(locationId: string, days: number) {
  const { from, to } = lastNDays(days);
  const [sales, shifts, closes, usage] = await Promise.all([
    prisma.dailySales.findMany({ where: { locationId, businessDate: { gte: from, lte: to } }, orderBy: { businessDate: "asc" } }),
    prisma.shift.findMany({ where: { locationId, start: { gte: from, lte: to } }, include: { employee: true, timeEntry: true } }),
    prisma.cashClose.findMany({ where: { locationId, businessDate: { gte: from, lte: to } } }),
    prisma.inventoryMovement.findMany({
      where: { locationId, occurredAt: { gte: from, lte: to }, type: "USAGE" },
      include: { ingredient: true },
    }),
  ]);

  const days_ = dayRange(from, to);
  return days_.map((d) => {
    const key = startOfDay(d).toISOString();
    const sale = sales.find((s) => startOfDay(s.businessDate).toISOString() === key);
    const close = closes.find((c) => startOfDay(c.businessDate).toISOString() === key);
    const dayShifts = shifts.filter((s) => startOfDay(s.start).toISOString() === key);
    const dayUsage = usage.filter((m) => startOfDay(m.occurredAt).toISOString() === key);
    const laborCents = dayShifts.reduce((a, s) => a + Math.round(((s.timeEntry?.actualMinutes ?? s.scheduledMinutes) / 60) * s.employee.hourlyRateCents), 0);
    const foodCents = dayUsage.reduce((a, m) => a + Math.round(Math.abs(m.qty) * m.ingredient.avgCostCents), 0);
    const net = sale?.netSalesCents ?? 0;
    return {
      date: fmtDate(d),
      iso: key,
      hasSales: !!sale,
      netSalesCents: net,
      tipsCents: sale?.tipsCents ?? 0,
      guests: sale?.guestCount ?? 0,
      foodCostCents: foodCents,
      laborCostCents: laborCents,
      foodPct: safeDivide(foodCents, net) * 100,
      laborPct: safeDivide(laborCents, net) * 100,
      cashOverShortCents: close?.overShortCents ?? 0,
    };
  });
}

export async function weeklyTrend(locationId: string, weeks: number) {
  const days = weeks * 7;
  const summary = await dailySummary(locationId, days);
  // bucket by week index from end
  const buckets: Record<number, typeof summary> = {};
  for (let i = 0; i < summary.length; i++) {
    const idx = Math.floor(i / 7);
    buckets[idx] = buckets[idx] ?? [];
    buckets[idx].push(summary[i]);
  }
  return Object.entries(buckets).map(([k, rows]) => {
    const sales = rows.reduce((a, r) => a + r.netSalesCents, 0);
    const food = rows.reduce((a, r) => a + r.foodCostCents, 0);
    const labor = rows.reduce((a, r) => a + r.laborCostCents, 0);
    return {
      label: `Week ${Number(k) + 1}`,
      from: rows[0].date,
      to: rows[rows.length - 1].date,
      netSalesCents: sales,
      foodCostCents: food,
      laborCostCents: labor,
      foodPct: safeDivide(food, sales) * 100,
      laborPct: safeDivide(labor, sales) * 100,
    };
  });
}

export async function purchaseSpendByPeriod(locationId: string, days: number) {
  const { from, to } = lastNDays(days);
  // Invoices are the operator's actual bills; POs cover anything ordered but
  // not yet invoiced. Both count toward supplier spend.
  const [pos, invoices] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { locationId, orderedAt: { gte: from, lte: to } },
      include: { supplier: { select: { name: true } } },
    }),
    prisma.invoice.findMany({
      where: { locationId, invoiceDate: { gte: from, lte: to } },
      select: { supplierId: true, totalCents: true, supplier: { select: { name: true } } },
    }),
  ]);
  const bySupplier = new Map<string, { name: string; orderCount: number; spendCents: number }>();
  const bump = (supplierId: string, name: string, cents: number) => {
    if (!bySupplier.has(supplierId)) bySupplier.set(supplierId, { name, orderCount: 0, spendCents: 0 });
    const e = bySupplier.get(supplierId)!;
    e.orderCount += 1;
    e.spendCents += cents;
  };
  for (const i of invoices) bump(i.supplierId, i.supplier.name, i.totalCents);
  for (const p of pos) bump(p.supplierId, p.supplier.name, p.totalCents);
  return Array.from(bySupplier.values()).sort((a, b) => b.spendCents - a.spendCents);
}

// Supplier spend matrix: how much has gone to each supplier, split by event
// tag and overall (all-time, invoice-based). Rows = suppliers, columns = the
// events that actually carry spend + an "untagged" bucket + a total.
export async function supplierSpendByEvent(locationId: string) {
  const invoices = await prisma.invoice.findMany({
    where: { locationId },
    select: {
      supplierId: true,
      totalCents: true,
      appliesToAllEvents: true,
      supplier: { select: { name: true } },
      event: { select: { id: true, name: true, color: true, startDate: true } },
    },
  });

  // Events that appear on at least one invoice, oldest first
  const eventMap = new Map<string, { id: string; name: string; color: string | null; startDate: Date }>();
  for (const inv of invoices) {
    if (inv.event && !eventMap.has(inv.event.id)) eventMap.set(inv.event.id, inv.event);
  }
  const events = [...eventMap.values()].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  type Row = { supplierId: string; name: string; byEvent: Record<string, number>; sharedCents: number; untaggedCents: number; totalCents: number };
  const rows = new Map<string, Row>();
  let grandTotal = 0;
  let grandUntagged = 0;
  let grandShared = 0;
  const eventTotals: Record<string, number> = {};

  for (const inv of invoices) {
    let row = rows.get(inv.supplierId);
    if (!row) {
      row = { supplierId: inv.supplierId, name: inv.supplier.name, byEvent: {}, sharedCents: 0, untaggedCents: 0, totalCents: 0 };
      rows.set(inv.supplierId, row);
    }
    row.totalCents += inv.totalCents;
    grandTotal += inv.totalCents;
    if (inv.appliesToAllEvents) {
      row.sharedCents += inv.totalCents;
      grandShared += inv.totalCents;
    } else if (inv.event) {
      row.byEvent[inv.event.id] = (row.byEvent[inv.event.id] ?? 0) + inv.totalCents;
      eventTotals[inv.event.id] = (eventTotals[inv.event.id] ?? 0) + inv.totalCents;
    } else {
      row.untaggedCents += inv.totalCents;
      grandUntagged += inv.totalCents;
    }
  }

  return {
    events: events.map((e) => ({ id: e.id, name: e.name, color: e.color })),
    suppliers: [...rows.values()].sort((a, b) => b.totalCents - a.totalCents),
    eventTotals,
    grandShared,
    grandUntagged,
    grandTotal,
    hasShared: grandShared > 0,
    hasUntagged: grandUntagged > 0,
  };
}

// Invoice spend by CATEGORY × event — mirrors supplierSpendByEvent but grouped
// by what the bill was for (Ingredients & Supplies, Packaging, etc.) instead
// of who it was billed by. Shared "all events" invoices get their own column,
// same as the supplier matrix; uncategorized invoices get an "Uncategorized"
// bucket instead of being dropped.
export async function categorySpendByEvent(locationId: string) {
  const invoices = await prisma.invoice.findMany({
    where: { locationId },
    select: {
      category: true,
      totalCents: true,
      appliesToAllEvents: true,
      event: { select: { id: true, name: true, color: true, startDate: true } },
    },
  });

  const eventMap = new Map<string, { id: string; name: string; color: string | null; startDate: Date }>();
  for (const inv of invoices) {
    if (inv.event && !eventMap.has(inv.event.id)) eventMap.set(inv.event.id, inv.event);
  }
  const events = [...eventMap.values()].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  type Row = { category: string; byEvent: Record<string, number>; sharedCents: number; untaggedCents: number; totalCents: number };
  const rows = new Map<string, Row>();
  let grandTotal = 0;
  let grandUntagged = 0;
  let grandShared = 0;
  const eventTotals: Record<string, number> = {};

  for (const inv of invoices) {
    const key = inv.category?.trim() || "Uncategorized";
    let row = rows.get(key);
    if (!row) {
      row = { category: key, byEvent: {}, sharedCents: 0, untaggedCents: 0, totalCents: 0 };
      rows.set(key, row);
    }
    row.totalCents += inv.totalCents;
    grandTotal += inv.totalCents;
    if (inv.appliesToAllEvents) {
      row.sharedCents += inv.totalCents;
      grandShared += inv.totalCents;
    } else if (inv.event) {
      row.byEvent[inv.event.id] = (row.byEvent[inv.event.id] ?? 0) + inv.totalCents;
      eventTotals[inv.event.id] = (eventTotals[inv.event.id] ?? 0) + inv.totalCents;
    } else {
      row.untaggedCents += inv.totalCents;
      grandUntagged += inv.totalCents;
    }
  }

  return {
    events: events.map((e) => ({ id: e.id, name: e.name, color: e.color })),
    categories: [...rows.values()].sort((a, b) => b.totalCents - a.totalCents),
    eventTotals,
    grandShared,
    grandUntagged,
    grandTotal,
    hasShared: grandShared > 0,
    hasUntagged: grandUntagged > 0,
  };
}

// P&L per event + overall. Event columns use the event tag for sales,
// invoices (COGS) and expenses, the event's own fee, and its date window for
// labor (shifts carry no tag). Overall covers everything in scope, including
// untagged rows, so it's the true business-wide picture.
export type PnlColumn = {
  key: string; // event id or "overall"
  name: string;
  color: string | null;
  txns: number;
  netSalesCents: number;
  tipsCents: number;
  // Supplier invoices for goods — what was consumed making what was sold.
  cogsCents: number;
  laborCents: number;
  // Recorded expenses, plus the supplier invoices this business books below
  // the gross-profit line: rent, marketing, equipment and the like.
  opexCents: number;
  feeCents: number; // event fees
  // Net sales less cost of goods — what the recipe itself earns, before any
  // cost of being open. The figure that says whether the menu works.
  grossProfitCents: number;
  grossMarginPct: number;
  profitCents: number;
  marginPct: number;
};

/**
 * P&L per event plus an overall column.
 *
 * `range` narrows every input to a date window and drops event columns that
 * don't overlap it, so the Overview's period control changes the statement
 * rather than just its heading. Omitted, the statement is all-time — which is
 * what the reports page and the CSV export want.
 */
export async function pnlByEvent(
  businessId: string,
  locationId: string,
  range?: { start: Date; end: Date } | null,
): Promise<PnlColumn[]> {
  const within = range ? { gte: range.start, lte: range.end } : undefined;
  const [business, allEvents, sales, invoices, expenses, shifts] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: { opexInvoiceCategories: true },
    }),
    prisma.event.findMany({
      where: { businessId },
      select: { id: true, name: true, color: true, startDate: true, endDate: true, feeCents: true },
      orderBy: { startDate: "asc" },
    }),
    prisma.dailySales.findMany({
      where: { locationId, ...(within ? { businessDate: within } : {}) },
      select: { eventId: true, netSalesCents: true, tipsCents: true, guestCount: true },
    }),
    prisma.invoice.findMany({
      where: { locationId, ...(within ? { invoiceDate: within } : {}) },
      select: { eventId: true, totalCents: true, appliesToAllEvents: true, category: true },
    }),
    prisma.expense.findMany({
      where: { locationId, ...(within ? { businessDate: within } : {}) },
      select: { eventId: true, amountCents: true },
    }),
    prisma.shift.findMany({
      where: { locationId, ...(within ? { start: within } : {}) },
      select: {
        start: true,
        scheduledMinutes: true,
        timeEntry: { select: { actualMinutes: true } },
        employee: { select: { hourlyRateCents: true } },
      },
    }),
  ]);

  // An event belongs in the statement when its dates overlap the window at
  // all — a two-week festival still counts when you're looking at one of its
  // weeks. Its fee, though, is a one-off, so it is only charged when the
  // event actually starts inside the window; otherwise a month-by-month read
  // would bill the same booth fee twice.
  const events = range
    ? allEvents.filter((e) => e.startDate <= range.end && e.endDate >= range.start)
    : allEvents;
  const feeFor = (e: (typeof allEvents)[number]) =>
    !range || (e.startDate >= range.start && e.startDate <= range.end) ? e.feeCents : 0;

  const shiftCost = (s: (typeof shifts)[number]) =>
    Math.round(((s.timeEntry?.actualMinutes ?? s.scheduledMinutes) / 60) * s.employee.hourlyRateCents);

  const opexCategories = business?.opexInvoiceCategories ?? [];
  const shareDiv = Math.max(1, events.length);
  const build = (key: string, name: string, color: string | null, filter: {
    eventId?: string;
    window?: { start: Date; end: Date };
    feeCents: number;
  }): PnlColumn => {
    const matchTag = <T extends { eventId: string | null }>(rows: T[]) =>
      filter.eventId ? rows.filter((r) => r.eventId === filter.eventId) : rows;
    const s = matchTag(sales);
    // Shared "all events" invoices join every event column at 1/N; the
    // overall column includes them once at full value.
    const inv = filter.eventId
      ? invoices
          .filter((r) => r.eventId === filter.eventId || r.appliesToAllEvents)
          .map((r) => (r.appliesToAllEvents ? { ...r, totalCents: Math.round(r.totalCents / shareDiv) } : r))
      : invoices;
    const exp = matchTag(expenses);
    const lab = filter.window
      ? shifts.filter((sh) => sh.start >= filter.window!.start && sh.start <= filter.window!.end)
      : shifts;

    const netSalesCents = s.reduce((a, r) => a + r.netSalesCents, 0);
    const tipsCents = s.reduce((a, r) => a + r.tipsCents, 0);
    const txns = s.reduce((a, r) => a + r.guestCount, 0);
    // Rent, marketing and a new urn are costs of being open, not costs of the
    // chai. Charging them against gross margin made the recipe look worse than
    // it is — see cost-classes.ts.
    const split = splitInvoiceCosts(inv, opexCategories);
    const cogsCents = split.cogsCents;
    const opexCents = exp.reduce((a, r) => a + r.amountCents, 0) + split.opexCents;
    const laborCents = lab.reduce((a, r) => a + shiftCost(r), 0);
    const grossProfitCents = netSalesCents - cogsCents;
    const grossMarginPct = netSalesCents > 0 ? (grossProfitCents / netSalesCents) * 100 : 0;
    const profitCents = netSalesCents - cogsCents - laborCents - opexCents - filter.feeCents;
    const marginPct = netSalesCents > 0 ? (profitCents / netSalesCents) * 100 : 0;

    return {
      key, name, color, txns, netSalesCents, tipsCents,
      cogsCents, laborCents, opexCents, feeCents: filter.feeCents,
      grossProfitCents, grossMarginPct,
      profitCents, marginPct,
    };
  };

  const columns = events.map((e) =>
    build(e.id, e.name, e.color, {
      eventId: e.id,
      window: { start: e.startDate, end: new Date(e.endDate.getTime() + 24 * 60 * 60 * 1000 - 1) },
      feeCents: feeFor(e),
    }),
  );
  const totalFees = events.reduce((a, e) => a + feeFor(e), 0);
  columns.push(build("overall", "Overall", null, { feeCents: totalFees }));
  return columns;
}
