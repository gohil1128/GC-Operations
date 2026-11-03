"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getScope } from "@/lib/scope";
import { writeAudit } from "@/lib/audit";
import { toCents } from "@/lib/money";
import { ingredientSchema, newCountSchema, wasteSchema } from "./schemas";
import { requireCan } from "@/lib/auth";
import { ownedId, requiredOwnedId, assertAllOwned } from "@/lib/ownership";

export async function createIngredientAction(formData: FormData) {
  await requireCan("inventory");
  const scope = await getScope();
  const parsed = ingredientSchema.parse({
    name: formData.get("name"),
    sku: formData.get("sku"),
    category: formData.get("category"),
    unit: formData.get("unit"),
    parLevel: formData.get("parLevel"),
    reorderPoint: formData.get("reorderPoint"),
    reorderQty: formData.get("reorderQty"),
    supplierId: formData.get("supplierId") || null,
    lastCostDollars: formData.get("lastCostDollars"),
  });
  const created = await prisma.ingredient.create({
    data: {
      businessId: scope.businessId,
      name: parsed.name,
      sku: parsed.sku || null,
      category: parsed.category || null,
      unit: parsed.unit,
      parLevel: parsed.parLevel,
      reorderPoint: parsed.reorderPoint,
      reorderQty: parsed.reorderQty,
      supplierId: await ownedId("supplier", scope.businessId, parsed.supplierId) || null,
      lastCostCents: toCents(parsed.lastCostDollars),
      avgCostCents: toCents(parsed.lastCostDollars),
    },
  });
  await writeAudit({ businessId: scope.businessId, userId: scope.userId, action: "ingredient.create", entityType: "Ingredient", entityId: created.id, diff: { name: created.name } });
  revalidatePath("/inventory");
  return { ok: true, id: created.id };
}

export async function updateIngredientAction(id: string, formData: FormData) {
  await requireCan("inventory");
  const scope = await getScope();
  const parsed = ingredientSchema.parse({
    name: formData.get("name"),
    sku: formData.get("sku"),
    category: formData.get("category"),
    unit: formData.get("unit"),
    parLevel: formData.get("parLevel"),
    reorderPoint: formData.get("reorderPoint"),
    reorderQty: formData.get("reorderQty"),
    supplierId: formData.get("supplierId") || null,
    lastCostDollars: formData.get("lastCostDollars"),
  });
  const existing = await prisma.ingredient.findFirst({ where: { id, businessId: scope.businessId } });
  if (!existing) throw new Error("Not found");

  // Optional "set on hand" — lets the operator record how much volume/stock
  // they actually have. Written as an ADJUSTMENT movement so the ledger stays
  // consistent instead of silently overwriting onHand.
  const onHandRaw = formData.get("onHand");
  const onHandNext = onHandRaw !== null && String(onHandRaw).trim() !== "" ? Number(onHandRaw) : null;
  const onHandDelta =
    onHandNext !== null && isFinite(onHandNext) && onHandNext >= 0 ? onHandNext - existing.onHand : 0;

  await prisma.$transaction(async (tx) => {
    await tx.ingredient.update({
      where: { id },
      data: {
        name: parsed.name,
        sku: parsed.sku || null,
        category: parsed.category || null,
        unit: parsed.unit,
        parLevel: parsed.parLevel,
        reorderPoint: parsed.reorderPoint,
        reorderQty: parsed.reorderQty,
        supplierId: await ownedId("supplier", scope.businessId, parsed.supplierId) || null,
        lastCostCents: toCents(parsed.lastCostDollars),
        ...(onHandDelta !== 0 ? { onHand: onHandNext! } : {}),
      },
    });
    if (onHandDelta !== 0) {
      await tx.inventoryMovement.create({
        data: {
          locationId: scope.locationId,
          ingredientId: id,
          type: "ADJUSTMENT",
          qty: onHandDelta,
          unit: parsed.unit,
          unitCostCents: existing.avgCostCents,
          sourceType: "ADJUST",
          note: `On-hand set to ${onHandNext} ${parsed.unit} via edit`,
        },
      });
    }
  });

  await writeAudit({
    businessId: scope.businessId, userId: scope.userId,
    action: "ingredient.update", entityType: "Ingredient", entityId: id,
    diff: onHandDelta !== 0 ? { unit: parsed.unit, onHand: onHandNext } : { unit: parsed.unit },
  });
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${id}`);
  return { ok: true };
}

export async function saveCountAction(formData: FormData) {
  await requireCan("inventoryCount");
  const scope = await getScope();
  const raw = JSON.parse(String(formData.get("payload") ?? "{}"));
  const parsed = newCountSchema.parse(raw);

  const ingredients = await prisma.ingredient.findMany({
    where: { businessId: scope.businessId, id: { in: parsed.lines.map((l) => l.ingredientId) } },
  });
  const ingMap = new Map(ingredients.map((i) => [i.id, i]));

  const count = await prisma.$transaction(async (tx) => {
    const c = await tx.inventoryCount.create({
      data: {
        locationId: scope.locationId,
        type: parsed.type,
        countedById: scope.userId,
        notes: parsed.notes ?? null,
      },
    });

    for (const line of parsed.lines) {
      const ing = ingMap.get(line.ingredientId);
      if (!ing) continue;
      const theoretical = ing.onHand;
      const variance = line.qtyCounted - theoretical;
      const varianceCostCents = Math.round(variance * ing.avgCostCents);
      await tx.inventoryCountLine.create({
        data: {
          countId: c.id,
          ingredientId: ing.id,
          qtyCounted: line.qtyCounted,
          unit: ing.unit,
          theoreticalQty: theoretical,
          varianceQty: variance,
          varianceCostCents,
        },
      });
      // reconcile: write COUNT_RECONCILE movement and update onHand
      await tx.inventoryMovement.create({
        data: {
          locationId: scope.locationId,
          ingredientId: ing.id,
          type: "COUNT_RECONCILE",
          qty: variance,
          unit: ing.unit,
          unitCostCents: ing.avgCostCents,
          sourceType: "COUNT",
          sourceId: c.id,
        },
      });
      await tx.ingredient.update({
        where: { id: ing.id },
        data: { onHand: line.qtyCounted },
      });
    }
    return c;
  });

  await writeAudit({ businessId: scope.businessId, userId: scope.userId, action: "count.create", entityType: "InventoryCount", entityId: count.id });
  revalidatePath("/inventory/variance");
  revalidatePath("/inventory/counts");
  revalidatePath("/inventory");
  redirect(`/inventory/variance`);
}

export async function recordWasteAction(formData: FormData) {
  await requireCan("inventory");
  const scope = await getScope();
  const parsed = wasteSchema.parse({
    ingredientId: formData.get("ingredientId"),
    qty: formData.get("qty"),
    note: formData.get("note"),
  });
  const ing = await prisma.ingredient.findFirst({ where: { id: parsed.ingredientId, businessId: scope.businessId } });
  if (!ing) throw new Error("Not found");
  await prisma.$transaction([
    prisma.inventoryMovement.create({
      data: {
        locationId: scope.locationId,
        ingredientId: ing.id,
        type: "WASTE",
        qty: -parsed.qty,
        unit: ing.unit,
        unitCostCents: ing.avgCostCents,
        sourceType: "WASTE",
        note: parsed.note ?? null,
      },
    }),
    prisma.ingredient.update({
      where: { id: ing.id },
      data: { onHand: { decrement: parsed.qty } },
    }),
  ]);
  await writeAudit({ businessId: scope.businessId, userId: scope.userId, action: "waste.record", entityType: "Ingredient", entityId: ing.id, diff: { qty: parsed.qty } });
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${ing.id}`);
  return { ok: true };
}

export async function quickCreateIngredientAction(input: {
  name: string;
  unit: string;
  category?: string | null;
  lastCostDollars?: number;
  supplierId?: string | null;
}): Promise<{ id: string; name: string; sku: string | null; unit: string; category: string | null; lastCostCents: number; supplierId: string | null }> {
  await requireCan("inventory");
  const scope = await getScope();
  const name = input.name.trim();
  const unit = input.unit.trim();
  if (!name) throw new Error("Name is required");
  if (!unit) throw new Error("Unit is required");
  const lastCostCents = toCents(input.lastCostDollars ?? 0);
  const created = await prisma.ingredient.create({
    data: {
      businessId: scope.businessId,
      name,
      unit,
      category: input.category?.trim() || null,
      supplierId: input.supplierId || null,
      parLevel: 0,
      reorderPoint: 0,
      reorderQty: 0,
      lastCostCents,
      avgCostCents: lastCostCents,
    },
    select: { id: true, name: true, sku: true, unit: true, category: true, lastCostCents: true, supplierId: true },
  });
  await writeAudit({
    businessId: scope.businessId,
    userId: scope.userId,
    action: "ingredient.quick_create",
    entityType: "Ingredient",
    entityId: created.id,
    diff: { name: created.name, unit: created.unit, source: "invoice_form" },
  });
  revalidatePath("/inventory");
  return created;
}

export async function deleteIngredientAction(id: string) {
  await requireCan("inventory");
  const scope = await getScope();
  const ing = await prisma.ingredient.findFirst({ where: { id, businessId: scope.businessId } });
  if (!ing) throw new Error("Not found");
  /*
    Every cascade is scoped to this business, not just keyed on the ingredient.

    These were `deleteMany({ where: { ingredientId: id } })` — correct only
    while no other business's row could point at this ingredient. Deleting an
    ingredient is an ordinary thing an owner does, and if a row elsewhere
    referenced it, that row was destroyed with no error and no trace. The
    ownership guards now stop such a reference being created, but a delete
    should not depend on another file having done its job.

    UnitConversion is the exception: it cascades on the Ingredient FK in the
    schema, so it belongs to this ingredient by construction.
  */
  await prisma.$transaction([
    prisma.inventoryMovement.deleteMany({
      where: { ingredientId: id, location: { businessId: scope.businessId } },
    }),
    prisma.inventoryCountLine.deleteMany({
      where: { ingredientId: id, count: { location: { businessId: scope.businessId } } },
    }),
    prisma.recipeIngredient.deleteMany({
      where: { ingredientId: id, recipe: { businessId: scope.businessId } },
    }),
    prisma.purchaseOrderItem.deleteMany({
      where: { ingredientId: id, purchaseOrder: { location: { businessId: scope.businessId } } },
    }),
    prisma.unitConversion.deleteMany({ where: { ingredientId: id } }),
    prisma.ingredient.delete({ where: { id } }),
  ]);
  await writeAudit({ businessId: scope.businessId, userId: scope.userId, action: "ingredient.delete", entityType: "Ingredient", entityId: id, diff: { name: ing.name } });
  revalidatePath("/inventory");
}
