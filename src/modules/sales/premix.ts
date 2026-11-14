import { prisma } from "@/lib/prisma";
import { isoFromBusinessDay } from "@/lib/date";
import { PREMIX_CATEGORY } from "@/modules/square/premix";
import type { PremixEvent, PremixRow } from "./premix-summary";

/*
  Premix sales, everywhere and always.

  The Home premix card is deliberately NOT scoped to the page's event picker:
  premix bags ($14.99 / $15.99) are a product line followed across every
  market, so this returns every premix row at the location, tagged to any event
  or none, one per flavour per day per event. The card's own filters (event,
  date sold) slice them in the browser. Premix rows are the ones the Square
  sync files under the "Premix" category (or named "Premix · ..."); a category
  set by hand in Settings counts too.
*/
export type PremixData = { unitCostCents: number; rows: PremixRow[]; events: PremixEvent[] };

export async function getPremixData(locationId: string, unitCostCents: number): Promise<PremixData | null> {
  const groups = await prisma.salesItem.groupBy({
    by: ["itemName", "businessDate", "eventId"],
    where: { locationId, OR: [{ category: PREMIX_CATEGORY }, { itemName: { startsWith: "Premix · " } }] },
    _sum: { qty: true, netSalesCents: true },
  });
  const rows: PremixRow[] = groups
    .map((g) => ({
      item: g.itemName,
      date: isoFromBusinessDay(g.businessDate),
      eventId: g.eventId,
      qty: g._sum.qty ?? 0,
      netSalesCents: g._sum.netSalesCents ?? 0,
    }))
    .filter((r) => r.qty !== 0 || r.netSalesCents !== 0);
  if (rows.length === 0) return null;
  const ids = [...new Set(rows.map((r) => r.eventId).filter((x): x is string => !!x))];
  const events = ids.length
    ? await prisma.event.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, startDate: true }, orderBy: { startDate: "desc" } })
    : [];
  return { unitCostCents, rows, events: events.map((e) => ({ id: e.id, name: e.name })) };
}
