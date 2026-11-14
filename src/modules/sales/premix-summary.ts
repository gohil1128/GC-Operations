/*
  Premix totals for a chosen slice: pure, so the Home card can re-add them in
  the browser as the event or date filter changes, with no round trip.

  A row is one flavour on one day at one event (or none). Dates are the stored
  business day as YYYY-MM-DD, which compares correctly as a string.
*/
export type PremixRow = { item: string; date: string; eventId: string | null; qty: number; netSalesCents: number };
export type PremixEvent = { id: string; name: string };

export type PremixFlavour = { name: string; qty: number; netSalesCents: number; profitCents: number };
export type PremixSummary = {
  netSalesCents: number;
  qty: number;
  /** Cost to make one bag, from Settings. */
  unitCostCents: number;
  costCents: number;
  profitCents: number;
  marginPct: number | null;
  days: number;
  events: number;
  flavours: PremixFlavour[];
};

/** "all" = every row; "none" = rows tagged to no event; otherwise an event id. */
export type PremixFilter = { eventId: string; from?: string; to?: string };

export function filterPremixRows(rows: PremixRow[], f: PremixFilter): PremixRow[] {
  return rows.filter(
    (r) =>
      (f.eventId === "all" || (f.eventId === "none" ? r.eventId === null : r.eventId === f.eventId)) &&
      (!f.from || r.date >= f.from) &&
      (!f.to || r.date <= f.to),
  );
}

export function summarisePremix(rows: PremixRow[], unitCostCents: number): PremixSummary | null {
  const byItem = new Map<string, { qty: number; net: number }>();
  const days = new Set<string>();
  const events = new Set<string>();
  for (const r of rows) {
    const name = r.item.replace(/^Premix · /, "");
    const cur = byItem.get(name) ?? { qty: 0, net: 0 };
    cur.qty += r.qty;
    cur.net += r.netSalesCents;
    byItem.set(name, cur);
    days.add(r.date);
    if (r.eventId) events.add(r.eventId);
  }
  const flavours = [...byItem]
    .map(([name, g]) => ({ name, qty: g.qty, netSalesCents: g.net, profitCents: Math.round(g.net - g.qty * unitCostCents) }))
    .filter((f) => f.qty !== 0 || f.netSalesCents !== 0)
    .sort((a, b) => b.netSalesCents - a.netSalesCents);
  if (flavours.length === 0) return null;
  const netSalesCents = flavours.reduce((a, f) => a + f.netSalesCents, 0);
  const qty = flavours.reduce((a, f) => a + f.qty, 0);
  const costCents = Math.round(qty * unitCostCents);
  return {
    netSalesCents,
    qty,
    unitCostCents,
    costCents,
    profitCents: netSalesCents - costCents,
    marginPct: netSalesCents > 0 ? ((netSalesCents - costCents) / netSalesCents) * 100 : null,
    days: days.size,
    events: events.size,
    flavours,
  };
}
