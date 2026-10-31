import { prisma } from "@/lib/prisma";
import { normalizeCategory } from "@/modules/items/categories";
import { getItemCosts } from "@/modules/items/costing";

/*
  Item sales, rolled up two ways over one date window.

  The Overview already computes a version of this, but only ever shows the top
  twelve items inside a rail card — which is fine for "what sold today" and
  useless for "how much of the season was cold chai". This returns the whole
  list plus the category totals, and is the only place that decides how an
  item's raw Square category maps onto a real menu category.
*/

export type SalesSort = "revenue" | "qty" | "profit" | "name";

export type ItemRow = {
  itemName: string;
  category: string;
  qty: number;
  netSalesCents: number;
  taxCents: number;
  txCount: number;
  sharePct: number;
  /* Costing, from the item's linked recipe. Null throughout when the item has
     no recipe against it — which is not the same as costing nothing, and is
     why these are nullable rather than zero. */
  recipeName: string | null;
  unitCostCents: number | null;
  costCents: number | null;
  profitCents: number | null;
  marginPct: number | null;
};

export type CategoryRow = {
  category: string;
  qty: number;
  netSalesCents: number;
  txCount: number;
  itemCount: number;
  sharePct: number;
  /** Only over the items in this category that are costed. */
  costedNetSalesCents: number;
  costedItemCount: number;
  costCents: number;
  profitCents: number;
  marginPct: number | null;
};

export async function getSalesBreakdown(params: {
  locationId: string;
  from: Date;
  to: Date;
  eventId?: string | null;
  category?: string | null;
  sort?: SalesSort;
}) {
  /*
    Rolled up by the database, not in Node.

    This used to read every SalesItem row in the window — and the window is
    effectively all of history, because event scoping is by tag and deliberately
    leaves the dates wide open. Three years of a sixty-item menu is tens of
    thousands of rows, deserialised on every page view, to produce one line per
    menu item.

    groupBy returns one row per (item, category) pair instead: bounded by the
    size of the menu, not by how long the customer has been trading. The rest of
    this function is unchanged, because it only ever needed the totals.

    Grouped by category as well as name so normalizeCategory still has its raw
    input; an item that changed category mid-life arrives as two groups and is
    merged below, exactly as it was when the rows were merged one by one.
  */
  const [groups, tradingDays, costs] = await Promise.all([
    prisma.salesItem.groupBy({
      by: ["itemName", "category"],
      where: {
        locationId: params.locationId,
        businessDate: { gte: params.from, lte: params.to },
        ...(params.eventId ? { eventId: params.eventId } : {}),
      },
      _sum: { qty: true, netSalesCents: true, taxCents: true, txCount: true },
    }),
    // One row per day that sold anything — bounded by days traded rather than
    // by item-rows, which is what the headline "N days" actually means.
    prisma.salesItem.groupBy({
      by: ["businessDate"],
      where: {
        locationId: params.locationId,
        businessDate: { gte: params.from, lte: params.to },
        ...(params.eventId ? { eventId: params.eventId } : {}),
      },
    }),
    getItemCosts(params.locationId),
  ]);

  const byItem = new Map<string, ItemRow>();
  for (const g of groups) {
    const category = normalizeCategory(g.category, g.itemName);
    const existing = byItem.get(g.itemName);
    const qty = g._sum.qty ?? 0;
    const netSalesCents = g._sum.netSalesCents ?? 0;
    const taxCents = g._sum.taxCents ?? 0;
    const txCount = g._sum.txCount ?? 0;
    if (existing) {
      existing.qty += qty;
      existing.netSalesCents += netSalesCents;
      existing.taxCents += taxCents;
      existing.txCount += txCount;
    } else {
      byItem.set(g.itemName, {
        itemName: g.itemName,
        category,
        qty,
        netSalesCents,
        taxCents,
        txCount,
        sharePct: 0,
        recipeName: null,
        unitCostCents: null,
        costCents: null,
        profitCents: null,
        marginPct: null,
      });
    }
  }

  // Cost every item that has a recipe against it. Quantities are summed first,
  // so the cost is one unit's cost times everything that sold in the window.
  for (const item of byItem.values()) {
    const cost = costs.get(item.itemName.toLowerCase());
    if (!cost || cost.unpriced) continue;
    item.recipeName = cost.recipeName;
    item.unitCostCents = cost.unitCostCents;
    item.costCents = Math.round(cost.unitCostCents * item.qty);
    item.profitCents = item.netSalesCents - item.costCents;
    item.marginPct = item.netSalesCents > 0 ? (item.profitCents / item.netSalesCents) * 100 : null;
  }

  const all = [...byItem.values()];
  // Share is always of the whole window, never of the filtered subset —
  // otherwise filtering to one category would show every item in it at a
  // share of 100% between them, which reads as a much bigger number than it is.
  const totalCents = all.reduce((a, i) => a + i.netSalesCents, 0);
  const totalQty = all.reduce((a, i) => a + i.qty, 0);
  const totalTx = all.reduce((a, i) => a + i.txCount, 0);

  const catMap = new Map<string, CategoryRow>();
  for (const i of all) {
    const ex =
      catMap.get(i.category) ??
      (catMap
        .set(i.category, {
          category: i.category,
          qty: 0,
          netSalesCents: 0,
          txCount: 0,
          itemCount: 0,
          sharePct: 0,
          costedNetSalesCents: 0,
          costedItemCount: 0,
          costCents: 0,
          profitCents: 0,
          marginPct: null,
        })
        .get(i.category) as CategoryRow);
    ex.qty += i.qty;
    ex.netSalesCents += i.netSalesCents;
    ex.txCount += i.txCount;
    ex.itemCount += 1;
    // A category's margin is over its costed items only. Folding in an
    // uncosted item's revenue at zero cost would report a 100% margin on it
    // and drag the category's number up for no reason but missing data.
    if (i.costCents !== null) {
      ex.costedNetSalesCents += i.netSalesCents;
      ex.costedItemCount += 1;
      ex.costCents += i.costCents;
      ex.profitCents += i.profitCents ?? 0;
    }
  }

  const byCategory = [...catMap.values()]
    .map((c) => ({
      ...c,
      sharePct: totalCents > 0 ? (c.netSalesCents / totalCents) * 100 : 0,
      marginPct: c.costedNetSalesCents > 0 ? (c.profitCents / c.costedNetSalesCents) * 100 : null,
    }))
    .sort((a, b) => b.netSalesCents - a.netSalesCents);

  const sort = params.sort ?? "revenue";
  const items = all
    .filter((i) => !params.category || i.category === params.category)
    .map((i) => ({ ...i, sharePct: totalCents > 0 ? (i.netSalesCents / totalCents) * 100 : 0 }))
    .sort((a, b) => {
      if (sort === "qty") return b.qty - a.qty;
      if (sort === "name") return a.itemName.localeCompare(b.itemName);
      // Uncosted items sink rather than sorting as zero profit, which would
      // scatter them through the middle of the list.
      if (sort === "profit") {
        if (a.profitCents === null) return b.profitCents === null ? 0 : 1;
        if (b.profitCents === null) return -1;
        return b.profitCents - a.profitCents;
      }
      return b.netSalesCents - a.netSalesCents;
    });

  const costed = all.filter((i) => i.costCents !== null);
  const costedNetCents = costed.reduce((a, i) => a + i.netSalesCents, 0);
  const costedCostCents = costed.reduce((a, i) => a + (i.costCents ?? 0), 0);

  /*
    The uncosted items worth doing something about, biggest first.

    "60 items are not costed" is true and useless — it is the same sentence
    whether the missing recipes are worth $40 or $15,000, and a business
    reading it has no way to know where to start. Naming the largest three,
    with what each is worth, turns the notice into an afternoon's work with an
    obvious first step.

    Taken from the whole scope rather than the filtered list, so it matches the
    totals beside it and a category filter cannot hide the item that matters
    most.
  */
  const topUncosted = all
    .filter((i) => i.costCents === null)
    .sort((a, b) => b.netSalesCents - a.netSalesCents)
    .slice(0, 3)
    .map((i) => ({ itemName: i.itemName, netSalesCents: i.netSalesCents, qty: i.qty }));
  const uncostedNetSalesCents = all
    .filter((i) => i.costCents === null)
    .reduce((a, i) => a + i.netSalesCents, 0);

  return {
    items,
    byCategory,
    totals: {
      netSalesCents: totalCents,
      qty: totalQty,
      txCount: totalTx,
      itemCount: all.length,
      dayCount: tradingDays.length,
      // Margin is reported over the costed slice only, with the count of what
      // is still missing shown beside it — a number that quietly treated
      // uncosted items as free would be flattering and wrong.
      costedItemCount: costed.length,
      uncostedItemCount: all.length - costed.length,
      uncostedNetSalesCents,
      topUncosted,
      costedNetSalesCents: costedNetCents,
      costCents: costedCostCents,
      profitCents: costedNetCents - costedCostCents,
      marginPct: costedNetCents > 0 ? ((costedNetCents - costedCostCents) / costedNetCents) * 100 : null,
    },
    /** Set when a category filter is on and matched nothing. */
    filteredCount: items.length,
  };
}
