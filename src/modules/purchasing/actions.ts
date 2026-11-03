"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getScope } from "@/lib/scope";
import { writeAudit } from "@/lib/audit";
import { toCents } from "@/lib/money";
import { newAvgCostCents } from "@/modules/inventory/costing";
import { newPoSchema, receivePoSchema, supplierSchema } from "./schemas";
import { requireCan } from "@/lib/auth";
import { ownedId, requiredOwnedId, assertAllOwned } from "@/lib/ownership";

export async function createSupplierAction(formData: FormData) {
  await requireCan("purchasing");
  const scope = await getScope();
  const parsed = supplierSchema.parse({
    name: formData.get("name"),
    email: formData.get("email") || "",
    phone: formData.get("phone"),
    terms: formData.get("terms"),
    leadTimeDays: formData.get("leadTimeDays"),
  });
  const s = await prisma.supplier.create({
    data: {
      businessId: scope.businessId,
      name: parsed.name,
      email: parsed.email || null,
      phone: parsed.phone || null,
      terms: parsed.terms || null,
      leadTimeDays: parsed.leadTimeDays,
    },
  });
  await writeAudit({ businessId: scope.businessId, userId: scope.userId, action: "supplier.create", entityType: "Supplier", entityId: s.id });
  revalidatePath("/purchasing");
}

// Minimal inline supplier creation used from the invoice form — just a name,
// details can be added later. Idempotent on name so re-typing an existing
// supplier reuses it instead of duplicating.
export async function quickCreateSupplierAction(nameRaw: string): Promise<{ id: string; name: string }> {
  await requireCan("purchasing");
  const scope = await getScope();
  const name = String(nameRaw ?? "").trim();
  if (!name) throw new Error("Supplier name is required");
  const existing = await prisma.supplier.findFirst({
    where: { businessId: scope.businessId, name: { equals: name, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (existing) return existing;
  const s = await prisma.supplier.create({
    data: { businessId: scope.businessId, name },
    select: { id: true, name: true },
  });
  await writeAudit({ businessId: scope.businessId, userId: scope.userId, action: "supplier.quick_create", entityType: "Supplier", entityId: s.id, diff: { name: s.name } });
  revalidatePath("/purchasing");
  revalidatePath("/purchasing/invoices/new");
  return s;
}

export async function createPoAction(payload: unknown) {
  await requireCan("purchasing");
  const scope = await getScope();
  const parsed = newPoSchema.parse(payload);

  /*
    The supplier and every ingredient must belong to this business before any
    of them is written. Without this, receivePoAction later ran
    ingredient.update() on whatever id was supplied — a write into another
    tenant's stock and costs.
  */
  const supplierId = await requiredOwnedId("supplier", scope.businessId, parsed.supplierId);
  await assertAllOwned("ingredient", scope.businessId, parsed.items.map((it) => it.ingredientId));

  const subtotalCents = parsed.items.reduce((a, it) => a + Math.round(it.qtyOrdered * toCents(it.unitCostDollars)), 0);
  const po = await prisma.purchaseOrder.create({
    data: {
      locationId: scope.locationId,
      supplierId,
      status: "DRAFT",
      expectedAt: parsed.expectedAt ? new Date(parsed.expectedAt) : null,
      notes: parsed.notes ?? null,
      subtotalCents,
      totalCents: subtotalCents,
      createdById: scope.userId,
      items: {
        create: parsed.items.map((it) => ({
          ingredientId: it.ingredientId,
          qtyOrdered: it.qtyOrdered,
          unit: it.unit,
          unitCostCents: toCents(it.unitCostDollars),
          lineTotalCents: Math.round(it.qtyOrdered * toCents(it.unitCostDollars)),
        })),
      },
    },
  });
  await writeAudit({ businessId: scope.businessId, userId: scope.userId, action: "po.create", entityType: "PurchaseOrder", entityId: po.id });
  revalidatePath("/purchasing");
  redirect(`/purchasing/${po.id}`);
}

export async function setPoStatusAction(poId: string, status: "DRAFT" | "SENT" | "CANCELLED") {
  await requireCan("purchasing");
  const scope = await getScope();
  const po = await prisma.purchaseOrder.findFirst({ where: { id: poId, locationId: scope.locationId } });
  if (!po) throw new Error("Not found");
  await prisma.purchaseOrder.update({ where: { id: poId }, data: { status } });
  await writeAudit({ businessId: scope.businessId, userId: scope.userId, action: "po.status", entityType: "PurchaseOrder", entityId: poId, diff: { status } });
  revalidatePath("/purchasing");
  revalidatePath(`/purchasing/${poId}`);
}

export async function receivePoAction(poId: string, payload: unknown) {
  await requireCan("purchasing");
  const scope = await getScope();
  const parsed = receivePoSchema.parse(payload);
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, locationId: scope.locationId },
    include: { items: { include: { ingredient: true } } },
  });
  if (!po) throw new Error("Not found");

  await prisma.$transaction(async (tx) => {
    for (const r of parsed.receipts) {
      const item = po.items.find((i) => i.id === r.itemId);
      if (!item) continue;
      if (r.qtyReceived <= 0) continue;

      await tx.purchaseOrderItem.update({
        where: { id: item.id },
        data: { qtyReceived: { increment: r.qtyReceived } },
      });

      await tx.inventoryMovement.create({
        data: {
          locationId: scope.locationId,
          ingredientId: item.ingredientId,
          type: "PURCHASE",
          qty: r.qtyReceived,
          unit: item.unit,
          unitCostCents: item.unitCostCents,
          sourceType: "PO",
          sourceId: po.id,
        },
      });

      const ing = item.ingredient;
      const newAvg = newAvgCostCents({
        currentOnHand: ing.onHand,
        currentAvgCostCents: ing.avgCostCents,
        receivedQty: r.qtyReceived,
        receivedUnitCostCents: item.unitCostCents,
      });
      await tx.ingredient.update({
        where: { id: ing.id },
        data: {
          onHand: { increment: r.qtyReceived },
          avgCostCents: newAvg,
          lastCostCents: item.unitCostCents,
        },
      });
    }

    // mark RECEIVED if all items fully received
    const refreshed = await tx.purchaseOrderItem.findMany({ where: { poId: po.id } });
    const allReceived = refreshed.every((i) => i.qtyReceived >= i.qtyOrdered);
    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: {
        status: allReceived ? "RECEIVED" : po.status === "DRAFT" ? "SENT" : po.status,
        receivedAt: allReceived ? new Date() : po.receivedAt,
      },
    });
  });

  await writeAudit({ businessId: scope.businessId, userId: scope.userId, action: "po.receive", entityType: "PurchaseOrder", entityId: po.id });
  revalidatePath("/purchasing");
  revalidatePath("/inventory");
  revalidatePath(`/purchasing/${po.id}`);
}

export async function deleteSupplierAction(id: string) {
  await requireCan("purchasing");
  const scope = await getScope();
  const s = await prisma.supplier.findFirst({ where: { id, businessId: scope.businessId } });
  if (!s) throw new Error("Not found");
  /*
    Unlink ingredients, delete POs (which cascade their items) — both scoped to
    this business rather than keyed on the supplier alone. Unscoped, deleting a
    supplier would have wiped any other business's purchase orders that
    referenced it, and silently blanked their ingredients' supplier links.
  */
  await prisma.$transaction([
    prisma.ingredient.updateMany({
      where: { supplierId: id, businessId: scope.businessId },
      data: { supplierId: null },
    }),
    prisma.purchaseOrder.deleteMany({
      where: { supplierId: id, location: { businessId: scope.businessId } },
    }),
    prisma.supplier.delete({ where: { id } }),
  ]);
  await writeAudit({ businessId: scope.businessId, userId: scope.userId, action: "supplier.delete", entityType: "Supplier", entityId: id, diff: { name: s.name } });
  revalidatePath("/purchasing");
  revalidatePath("/purchasing");
}

export async function deletePoAction(id: string) {
  await requireCan("purchasing");
  const scope = await getScope();
  const po = await prisma.purchaseOrder.findFirst({ where: { id, locationId: scope.locationId } });
  if (!po) throw new Error("Not found");
  await prisma.purchaseOrder.delete({ where: { id } });
  await writeAudit({ businessId: scope.businessId, userId: scope.userId, action: "po.delete", entityType: "PurchaseOrder", entityId: id });
  revalidatePath("/purchasing");
}
