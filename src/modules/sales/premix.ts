import { prisma } from "@/lib/prisma";
import { PREMIX_CATEGORY } from "@/modules/square/premix";

/*
  Premix sales, everywhere and always.

  The Home premix card is deliberately NOT scoped to the chosen event: premix
  bags ($14.99 / $15.99) are a product line followed across every market, so
  this adds up every premix row at the location, tagged to any event or none.
  Premix rows are the ones the Square sync files under the "Premix" category
  (or named "Premix · ..."); a category set by hand in Settings counts too.
*/
export type PremixFlavour = { name: string; qty: number; netSalesCents: number };
export type PremixSummary = {
  netSalesCents: number;
  qty: number;
  days: number;
  events: number;
  flavours: PremixFlavour[];
};

export async function getPremixSummary(locationId: string): Promise<PremixSummary | null> {
  const where = {
    locationId,
    OR: [{ category: PREMIX_CATEGORY }, { itemName: { startsWith: "Premix · " } }],
  };
  const [byItem, byDay, byEvent] = await Promise.all([
    prisma.salesItem.groupBy({ by: ["itemName"], where, _sum: { qty: true, netSalesCents: true } }),
    prisma.salesItem.groupBy({ by: ["businessDate"], where }),
    prisma.salesItem.groupBy({ by: ["eventId"], where: { ...where, eventId: { not: null } } }),
  ]);
  if (byItem.length === 0) return null;
  const flavours = byItem
    .map((g) => ({
      name: g.itemName.replace(/^Premix · /, ""),
      qty: g._sum.qty ?? 0,
      netSalesCents: g._sum.netSalesCents ?? 0,
    }))
    .filter((f) => f.qty !== 0 || f.netSalesCents !== 0)
    .sort((a, b) => b.netSalesCents - a.netSalesCents);
  if (flavours.length === 0) return null;
  return {
    netSalesCents: flavours.reduce((a, f) => a + f.netSalesCents, 0),
    qty: flavours.reduce((a, f) => a + f.qty, 0),
    days: byDay.length,
    events: byEvent.length,
    flavours,
  };
}
