import { prisma } from "@/lib/prisma";

/*
  Everything this location has bought before, as an order list.

  Built from invoice line items and purchase-order lines: one entry per
  ingredient, carrying who it was last bought from, at what price and in what
  unit, when, and how many times. Invoices logged from email carry totals only
  (no lines), so they cannot add items here.
*/
export type OrderableItem = {
  ingredientId: string;
  name: string;
  category: string | null;
  sku: string | null;
  unit: string;
  supplierId: string | null;
  supplierName: string;
  lastUnitCostCents: number;
  lastQty: number;
  lastBoughtAt: string; // YYYY-MM-DD
  timesBought: number;
  onHand: number;
  parLevel: number;
};

export async function listOrderableItems(locationId: string, businessId: string): Promise<OrderableItem[]> {
  const [invLines, poLines] = await Promise.all([
    prisma.invoiceItem.findMany({
      where: { invoice: { locationId } },
      select: {
        ingredientId: true, qty: true, unit: true, unitCostCents: true,
        invoice: { select: { invoiceDate: true, supplierId: true, supplier: { select: { name: true } } } },
      },
    }),
    prisma.purchaseOrderItem.findMany({
      where: { purchaseOrder: { locationId, status: { not: "CANCELLED" } } },
      select: {
        ingredientId: true, qtyOrdered: true, unit: true, unitCostCents: true,
        purchaseOrder: { select: { orderedAt: true, supplierId: true, supplier: { select: { name: true } } } },
      },
    }),
  ]);

  type Buy = { ingredientId: string; qty: number; unit: string; cost: number; at: Date; supplierId: string; supplierName: string };
  const buys: Buy[] = [
    ...invLines.map((l) => ({
      ingredientId: l.ingredientId, qty: l.qty, unit: l.unit, cost: l.unitCostCents,
      at: l.invoice.invoiceDate, supplierId: l.invoice.supplierId, supplierName: l.invoice.supplier.name,
    })),
    ...poLines.map((l) => ({
      ingredientId: l.ingredientId, qty: l.qtyOrdered, unit: l.unit, cost: l.unitCostCents,
      at: l.purchaseOrder.orderedAt, supplierId: l.purchaseOrder.supplierId, supplierName: l.purchaseOrder.supplier.name,
    })),
  ];
  if (buys.length === 0) return [];

  const latest = new Map<string, Buy & { times: number }>();
  for (const b of buys) {
    const cur = latest.get(b.ingredientId);
    if (!cur) latest.set(b.ingredientId, { ...b, times: 1 });
    else {
      const times = cur.times + 1;
      latest.set(b.ingredientId, b.at > cur.at ? { ...b, times } : { ...cur, times });
    }
  }

  const ingredients = await prisma.ingredient.findMany({
    where: { businessId, id: { in: [...latest.keys()] } },
    select: { id: true, name: true, category: true, sku: true, onHand: true, parLevel: true },
  });

  return ingredients
    .map((i) => {
      const b = latest.get(i.id)!;
      return {
        ingredientId: i.id, name: i.name, category: i.category, sku: i.sku,
        unit: b.unit, supplierId: b.supplierId, supplierName: b.supplierName,
        lastUnitCostCents: b.cost, lastQty: b.qty, lastBoughtAt: b.at.toISOString().slice(0, 10),
        timesBought: b.times, onHand: i.onHand, parLevel: i.parLevel,
      };
    })
    .sort((a, b) => a.supplierName.localeCompare(b.supplierName) || a.name.localeCompare(b.name));
}
