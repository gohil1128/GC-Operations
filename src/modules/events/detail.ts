import { prisma } from "@/lib/prisma";
import { endOfDay, startOfDay } from "@/lib/date";
import { pnlByEvent, type PnlColumn } from "@/modules/reports/queries";

/*
  Everything the business has recorded against one event.

  Six models carry an `eventId` — daily sales, per-item sales, cash closes,
  invoices, expenses and capital assets — and those tags are what "belongs to
  this event" means. Two things do NOT carry the tag and are derived instead,
  which the page has to say out loud rather than quietly present as tagged:

  - Labor. Shifts have no event column, so the only honest attribution is the
    event's own date window. A shift on the day of the event counts; one worked
    for it a week earlier does not.
  - Shared invoices. An invoice flagged `appliesToAllEvents` belongs to every
    event at 1/N. It is listed separately from the event's own invoices, with
    the share shown, so the number in the P&L can be traced.

  The P&L figures come from `pnlByEvent` rather than being recomputed here, so
  the event page and the Overview's statement can never drift apart.
*/

export type EventDetail = Awaited<ReturnType<typeof getEventDetail>>;

export async function getEventDetail(businessId: string, locationId: string, eventId: string) {
  const event = await prisma.event.findFirst({ where: { id: eventId, businessId } });
  if (!event) return null;

  const from = startOfDay(event.startDate);
  const to = endOfDay(event.endDate);

  const [sales, itemRows, invoices, sharedInvoices, expenses, cashCloses, assets, shifts, eventCount, pnl] =
    await Promise.all([
      prisma.dailySales.findMany({
        where: { locationId, eventId },
        orderBy: { businessDate: "asc" },
      }),
      prisma.salesItem.findMany({
        where: { locationId, eventId },
        select: { itemName: true, category: true, qty: true, netSalesCents: true, txCount: true },
      }),
      prisma.invoice.findMany({
        where: { locationId, eventId },
        select: {
          id: true,
          invoiceNumber: true,
          invoiceDate: true,
          category: true,
          totalCents: true,
          closedAt: true,
          supplier: { select: { name: true } },
          _count: { select: { items: true } },
        },
        orderBy: { invoiceDate: "asc" },
      }),
      prisma.invoice.findMany({
        where: { locationId, appliesToAllEvents: true },
        select: {
          id: true,
          invoiceNumber: true,
          invoiceDate: true,
          totalCents: true,
          closedAt: true,
          supplier: { select: { name: true } },
        },
        orderBy: { invoiceDate: "asc" },
      }),
      prisma.expense.findMany({
        where: { locationId, eventId },
        select: {
          id: true,
          businessDate: true,
          category: true,
          amountCents: true,
          description: true,
          vendor: { select: { name: true } },
        },
        orderBy: { businessDate: "asc" },
      }),
      prisma.cashClose.findMany({
        where: { locationId, eventId },
        orderBy: { businessDate: "asc" },
      }),
      prisma.capitalAsset.findMany({
        where: { locationId, eventId },
        orderBy: { purchaseDate: "asc" },
      }),
      // Labor is date-derived, not tagged — see the note at the top.
      prisma.shift.findMany({
        where: { locationId, start: { gte: from, lte: to } },
        select: {
          id: true,
          start: true,
          scheduledMinutes: true,
          timeEntry: { select: { actualMinutes: true } },
          employee: { select: { name: true, hourlyRateCents: true } },
        },
        orderBy: { start: "asc" },
      }),
      prisma.event.count({ where: { businessId } }),
      pnlByEvent(businessId, locationId),
    ]);

  // Items rolled up by name, biggest earner first.
  const byItem = new Map<string, { itemName: string; category: string | null; qty: number; netSalesCents: number; txCount: number }>();
  for (const r of itemRows) {
    const ex = byItem.get(r.itemName);
    if (ex) {
      ex.qty += r.qty;
      ex.netSalesCents += r.netSalesCents;
      ex.txCount += r.txCount;
    } else {
      byItem.set(r.itemName, { ...r });
    }
  }
  const items = [...byItem.values()].sort((a, b) => b.netSalesCents - a.netSalesCents);

  const shiftCost = (s: (typeof shifts)[number]) =>
    Math.round(((s.timeEntry?.actualMinutes ?? s.scheduledMinutes) / 60) * s.employee.hourlyRateCents);
  const labor = shifts.map((s) => ({
    id: s.id,
    start: s.start,
    employee: s.employee.name,
    minutes: s.timeEntry?.actualMinutes ?? s.scheduledMinutes,
    actual: s.timeEntry?.actualMinutes != null,
    costCents: shiftCost(s),
  }));

  // Mirrors pnlByEvent's split so the shared figure on this page and the COGS
  // line in the statement are the same number.
  const shareDiv = Math.max(1, eventCount);
  const sharedShareCents = sharedInvoices.reduce(
    (a, r) => a + Math.round(r.totalCents / shareDiv),
    0,
  );

  const column: PnlColumn | null = pnl.find((c) => c.key === eventId) ?? null;

  return {
    event,
    column,
    sales,
    items,
    invoices,
    shared: {
      invoices: sharedInvoices,
      shareDiv,
      shareCents: sharedShareCents,
      totalCents: sharedInvoices.reduce((a, r) => a + r.totalCents, 0),
    },
    expenses,
    cashCloses,
    assets,
    labor,
    totals: {
      salesNetCents: sales.reduce((a, r) => a + r.netSalesCents, 0),
      salesTipsCents: sales.reduce((a, r) => a + r.tipsCents, 0),
      salesTaxCents: sales.reduce((a, r) => a + r.taxCents, 0),
      guests: sales.reduce((a, r) => a + r.guestCount, 0),
      itemsQty: items.reduce((a, r) => a + r.qty, 0),
      itemsNetCents: items.reduce((a, r) => a + r.netSalesCents, 0),
      invoicesCents: invoices.reduce((a, r) => a + r.totalCents, 0),
      invoicesOpen: invoices.filter((r) => !r.closedAt).length,
      expensesCents: expenses.reduce((a, r) => a + r.amountCents, 0),
      laborCents: labor.reduce((a, r) => a + r.costCents, 0),
      assetsCents: assets.reduce((a, r) => a + r.purchasePriceCents, 0),
      cashOverShortCents: cashCloses.reduce((a, r) => a + r.overShortCents, 0),
    },
  };
}

/** The events index: every event with the headline numbers, newest first. */
export async function listEventsWithTotals(businessId: string, locationId: string) {
  const [events, pnl, invoiceSpend, expenseSpend] = await Promise.all([
    prisma.event.findMany({ where: { businessId }, orderBy: { startDate: "desc" } }),
    pnlByEvent(businessId, locationId),
    /*
      Spend tagged to this event and this event only.

      The P&L column cannot answer this: it carries each event's 1/N share of
      every invoice flagged "applies to all events", so an event created a
      minute ago already shows COGS against it. That share is real for
      reporting, but it is not evidence anybody bought anything *for* this
      event — and telling those two apart is exactly what says whether an
      event with no sales has been stocked up or simply has not happened yet.
    */
    prisma.invoice.groupBy({
      by: ["eventId"],
      where: { locationId, eventId: { not: null }, appliesToAllEvents: false },
      _sum: { totalCents: true },
    }),
    prisma.expense.groupBy({
      by: ["eventId"],
      where: { locationId, eventId: { not: null } },
      _sum: { amountCents: true },
    }),
  ]);

  const byKey = new Map(pnl.map((c) => [c.key, c]));
  const ownSpend = new Map<string, number>();
  for (const r of invoiceSpend) {
    if (r.eventId) ownSpend.set(r.eventId, (ownSpend.get(r.eventId) ?? 0) + (r._sum.totalCents ?? 0));
  }
  for (const r of expenseSpend) {
    if (r.eventId) ownSpend.set(r.eventId, (ownSpend.get(r.eventId) ?? 0) + (r._sum.amountCents ?? 0));
  }

  return events.map((e) => ({
    event: e,
    column: byKey.get(e.id) ?? null,
    // The booth fee is money committed to this event specifically, so it counts.
    ownSpendCents: (ownSpend.get(e.id) ?? 0) + e.feeCents,
  }));
}
