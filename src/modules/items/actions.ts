"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getScope } from "@/lib/scope";
import { requireOwner } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

// Set the category for every imported sales row that shares this item name at
// the active location. Stored on the raw `category` field so it survives
// re-imports of the same item (the importers only overwrite blanks).
export async function setItemCategoryAction(itemName: string, category: string | null) {
  await requireOwner();
  const scope = await getScope();
  const name = itemName.trim();
  if (!name) throw new Error("Missing item");
  const value = category && category.trim() ? category.trim() : null;

  const res = await prisma.salesItem.updateMany({
    where: { locationId: scope.locationId, itemName: name },
    data: { category: value },
  });

  await writeAudit({
    businessId: scope.businessId,
    userId: scope.userId,
    action: "item.set_category",
    entityType: "SalesItem",
    diff: { itemName: name, category: value, rowsUpdated: res.count },
  });
  revalidatePath("/settings/integrations");
  revalidatePath("/dashboard");
  return { rowsUpdated: res.count };
}

/*
  Point a sold item at the recipe it is made from, or clear the link.

  Stored against the item NAME, not the sales rows, so it survives the next
  CSV import — which replaces rows but not names.
*/
export async function setItemRecipeAction(itemName: string, recipeId: string | null) {
  await requireOwner();
  const scope = await getScope();
  const name = itemName.trim();
  if (!name) throw new Error("Missing item");

  if (!recipeId) {
    await prisma.itemRecipeLink.deleteMany({ where: { locationId: scope.locationId, itemName: name } });
  } else {
    // Scoped to the business so a guessed id cannot link to another tenant's recipe.
    const recipe = await prisma.recipe.findFirst({
      where: { id: recipeId, businessId: scope.businessId },
      select: { id: true },
    });
    if (!recipe) throw new Error("Recipe not found");
    await prisma.itemRecipeLink.upsert({
      where: { locationId_itemName: { locationId: scope.locationId, itemName: name } },
      create: { locationId: scope.locationId, itemName: name, recipeId: recipe.id },
      update: { recipeId: recipe.id },
    });
  }

  await writeAudit({
    businessId: scope.businessId,
    userId: scope.userId,
    action: "item.set_recipe",
    entityType: "ItemRecipeLink",
    diff: { itemName: name, recipeId },
  });
  revalidatePath("/settings/integrations");
  revalidatePath("/sales");
  return { ok: true };
}

// Delete every imported sales row for this item name at the active location.
// (DailySales day totals are a separate grain and are left untouched.)
export async function deleteItemSalesAction(itemName: string) {
  await requireOwner();
  const scope = await getScope();
  const name = itemName.trim();
  if (!name) throw new Error("Missing item");

  const res = await prisma.salesItem.deleteMany({
    where: { locationId: scope.locationId, itemName: name },
  });

  await writeAudit({
    businessId: scope.businessId,
    userId: scope.userId,
    action: "item.delete_sales",
    entityType: "SalesItem",
    diff: { itemName: name, rowsDeleted: res.count },
  });
  revalidatePath("/settings/integrations");
  revalidatePath("/dashboard");
  return { rowsDeleted: res.count };
}
