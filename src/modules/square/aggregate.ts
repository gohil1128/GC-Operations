import { dayKeyInZone } from "@/lib/date";
import type { Money, SquareLineItem, SquareOrder } from "./client";
import { isPremixPrice, PREMIX_CATEGORY, premixItemName } from "./premix";

/*
  Square orders -> one set of totals per business day.

  Pure: no database, no network. Everything that decides what a day's numbers
  ARE lives here, so it can be tested against hand-built orders.

  How each figure is defined, matching Square's own Sales Summary so the two
  agree when someone checks:

    net sales  what the items sold for after discounts, before tax and tips:
               each line's total minus its tax. Returns subtract the same way,
               on the day the refund was made (that is where Square puts them).
    tax        each line's tax, less returned lines' tax.
    tips       the order's tips, less tips given back on a return.
    card/cash  what was taken by each kind of tender, tips included — the
               "Card" and "Cash" lines of the Sales Summary.
    sales      orders that sold at least one line. A refund is not a sale.

  An order is filed on the day it CLOSED, in the Square location's timezone:
  a market that runs past midnight UTC is still that evening's market.
*/

export type ItemTotals = {
  name: string;
  qty: number;
  netCents: number;
  taxCents: number;
  /** Sales that included this item at least once. */
  txCount: number;
  variationIds: Set<string>;
  /** Set on premix lines, which the sync files under that category. */
  category?: string;
};

export type DayTotals = {
  day: string; // YYYY-MM-DD
  sales: number;
  netCents: number;
  taxCents: number;
  tipsCents: number;
  cardCents: number;
  cashCents: number;
  otherCents: number;
  items: Map<string, ItemTotals>;
};

/** Square sends amounts as integers in the smallest unit; older payloads sometimes as strings. */
export function cents(m: Money): number {
  const v = m?.amount;
  const n = typeof v === "string" ? Number(v) : v ?? 0;
  return Number.isFinite(n) ? Math.round(n as number) : 0;
}

/** Square leaves a custom amount's line unnamed; its own reports call it this. */
export const CUSTOM_AMOUNT = "Custom Amount";
const itemName = (l: SquareLineItem) => (l.name ?? "").trim() || CUSTOM_AMOUNT;
/** A line's unit price in cents, before tax and discounts. */
function unitPriceCents(l: SquareLineItem): number {
  const base = cents(l.base_price_money);
  if (base > 0) return base;
  const q = Number(l.quantity ?? "0");
  const gross = cents(l.gross_sales_money);
  return q > 0 && gross > 0 ? Math.round(gross / q) : 0;
}
/** The item row a line belongs to: premix lines get their own, everything else its name. */
function rowKey(l: SquareLineItem): { name: string; premix: boolean } {
  const unit = unitPriceCents(l);
  return isPremixPrice(unit) ? { name: premixItemName(l.name, unit), premix: true } : { name: itemName(l), premix: false };
}
const qtyOf = (l: SquareLineItem) => {
  const n = Number(l.quantity ?? "0");
  return Number.isFinite(n) ? n : 0;
};

/** The currency every amount in an order is in, or null if it has none. */
function orderCurrency(o: SquareOrder): string | null {
  for (const l of o.line_items ?? []) if (l.total_money?.currency) return l.total_money.currency;
  for (const r of o.returns ?? []) for (const l of r.return_line_items ?? []) if (l.total_money?.currency) return l.total_money.currency;
  for (const t of o.tenders ?? []) if (t.amount_money?.currency) return t.amount_money.currency;
  return null;
}

export type Aggregate = {
  days: Map<string, DayTotals>;
  /** Orders left out because they were not in the business's currency. */
  foreignCurrency: number;
};

export function aggregateOrders(orders: SquareOrder[], timeZone: string, currency: string): Aggregate {
  const days = new Map<string, DayTotals>();
  let foreignCurrency = 0;

  const dayFor = (key: string): DayTotals => {
    let d = days.get(key);
    if (!d) {
      d = { day: key, sales: 0, netCents: 0, taxCents: 0, tipsCents: 0, cardCents: 0, cashCents: 0, otherCents: 0, items: new Map() };
      days.set(key, d);
    }
    return d;
  };
  const itemFor = (d: DayTotals, name: string, premix = false): ItemTotals => {
    let i = d.items.get(name);
    if (!i) {
      i = { name, qty: 0, netCents: 0, taxCents: 0, txCount: 0, variationIds: new Set(), ...(premix ? { category: PREMIX_CATEGORY } : {}) };
      d.items.set(name, i);
    }
    return i;
  };

  for (const o of orders) {
    if (o.state && o.state !== "COMPLETED") continue;
    if (!o.closed_at) continue;
    const cur = orderCurrency(o);
    // Never add a US$ sale to a C$ day: held out and counted, not converted.
    if (cur && cur !== currency) { foreignCurrency++; continue; }

    const d = dayFor(dayKeyInZone(o.closed_at, timeZone));
    const lines = o.line_items ?? [];
    const seen = new Set<string>();

    for (const l of lines) {
      const tax = cents(l.total_tax_money);
      const net = cents(l.total_money) - tax;
      const k = rowKey(l);
      const i = itemFor(d, k.name, k.premix);
      i.qty += qtyOf(l);
      i.netCents += net;
      i.taxCents += tax;
      if (l.catalog_object_id) i.variationIds.add(l.catalog_object_id);
      if (!seen.has(i.name)) { i.txCount++; seen.add(i.name); }
      d.netCents += net;
      d.taxCents += tax;
    }

    for (const r of o.returns ?? []) {
      for (const l of r.return_line_items ?? []) {
        const tax = cents(l.total_tax_money);
        const net = cents(l.total_money) - tax;
        const k = rowKey(l);
        const i = itemFor(d, k.name, k.premix);
        i.qty -= qtyOf(l);
        i.netCents -= net;
        i.taxCents -= tax;
        d.netCents -= net;
        d.taxCents -= tax;
      }
    }

    d.tipsCents += cents(o.total_tip_money) - cents(o.return_amounts?.tip_money);

    for (const t of o.tenders ?? []) {
      const amt = cents(t.amount_money);
      if (t.type === "CARD") d.cardCents += amt;
      else if (t.type === "CASH") d.cashCents += amt;
      else d.otherCents += amt;
    }

    if (lines.length > 0) d.sales++;
  }

  // An item sold and refunded the same day nets to nothing and is not worth a
  // row; one refunded on a LATER day keeps its negative row there, so the later
  // day's items still add up to that day's total.
  for (const d of days.values()) {
    for (const [name, i] of d.items) if (i.qty === 0 && i.netCents === 0 && i.taxCents === 0) d.items.delete(name);
  }

  return { days, foreignCurrency };
}

/* ── days and instants in a named timezone ── */

function offsetMs(at: Date, timeZone: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(at).map((x) => [x.type, x.value]),
  );
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return wall - Math.floor(at.getTime() / 1000) * 1000;
}

/** The instant a calendar day begins in a named timezone (DST-safe). */
export function startOfDayInZone(iso: string, timeZone: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  const wallMidnight = Date.UTC(y, m - 1, d);
  // Twice, because the offset at the guess can differ from the offset at the
  // answer when a DST change falls between them.
  let t = wallMidnight - offsetMs(new Date(wallMidnight), timeZone);
  t = wallMidnight - offsetMs(new Date(t), timeZone);
  return new Date(t);
}

export function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
