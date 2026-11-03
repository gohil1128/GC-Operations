"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getScope } from "@/lib/scope";
import { writeAudit } from "@/lib/audit";
import { toCents } from "@/lib/money";
import { recipeSchema, updateBomSchema } from "./schemas";
import { requireCan } from "@/lib/auth";
import { ownedId, requiredOwnedId, assertAllOwned } from "@/lib/ownership";

export async function createRecipeAction(formData: FormData) {
  await requireCan("inventory");
  const scope = await getScope();
  const parsed = recipeSchema.parse({
    name: formData.get("name"),
    category: formData.get("category"),
    menuPriceDollars: formData.get("menuPriceDollars"),
    yieldQty: formData.get("yieldQty"),
    yieldUnit: formData.get("yieldUnit"),
    isActive: formData.get("isActive") === "on" || formData.get("isActive") === "true",
  });
  const r = await prisma.recipe.create({
    data: {
      businessId: scope.businessId,
      name: parsed.name,
      category: parsed.category || null,
      menuPriceCents: toCents(parsed.menuPriceDollars),
      yieldQty: parsed.yieldQty,
      yieldUnit: parsed.yieldUnit,
      isActive: parsed.isActive,
    },
  });
  await writeAudit({ businessId: scope.businessId, userId: scope.userId, action: "recipe.create", entityType: "Recipe", entityId: r.id });
  revalidatePath("/recipes");
  redirect(`/recipes/${r.id}`);
}

export async function updateRecipeAction(id: string, formData: FormData) {
  await requireCan("inventory");
  const scope = await getScope();
  const parsed = recipeSchema.parse({
    name: formData.get("name"),
    category: formData.get("category"),
    menuPriceDollars: formData.get("menuPriceDollars"),
    yieldQty: formData.get("yieldQty"),
    yieldUnit: formData.get("yieldUnit"),
    isActive: formData.get("isActive") === "on" || formData.get("isActive") === "true",
  });
  const r = await prisma.recipe.findFirst({ where: { id, businessId: scope.businessId } });
  if (!r) throw new Error("Not found");
  await prisma.recipe.update({
    where: { id },
    data: {
      name: parsed.name,
      category: parsed.category || null,
      menuPriceCents: toCents(parsed.menuPriceDollars),
      yieldQty: parsed.yieldQty,
      yieldUnit: parsed.yieldUnit,
      isActive: parsed.isActive,
    },
  });
  await writeAudit({ businessId: scope.businessId, userId: scope.userId, action: "recipe.update", entityType: "Recipe", entityId: id });
  revalidatePath("/recipes");
  revalidatePath(`/recipes/${id}`);
}

export async function updateBomAction(recipeId: string, payload: unknown) {
  await requireCan("inventory");
  const scope = await getScope();
  const parsed = updateBomSchema.parse(payload);
  const r = await prisma.recipe.findFirst({ where: { id: recipeId, businessId: scope.businessId } });
  if (!r) throw new Error("Not found");

  // The recipe was checked; the ingredients were not. Costing reads the joined
  // ingredient's avgCostCents, so an unowned id both prices this recipe off
  // someone else's stock and renders their costs on this page.
  await assertAllOwned("ingredient", scope.businessId, parsed.items.map((i) => i.ingredientId));

  await prisma.$transaction([
    prisma.recipeIngredient.deleteMany({ where: { recipeId } }),
    prisma.recipeIngredient.createMany({
      data: parsed.items
        .filter((i) => i.qty > 0)
        .map((i) => ({ recipeId, ingredientId: i.ingredientId, qty: i.qty, unit: i.unit })),
      skipDuplicates: true,
    }),
  ]);
  await writeAudit({ businessId: scope.businessId, userId: scope.userId, action: "recipe.bom.update", entityType: "Recipe", entityId: recipeId });
  revalidatePath("/recipes");
  revalidatePath(`/recipes/${recipeId}`);
}

export async function deleteRecipeAction(id: string) {
  await requireCan("inventory");
  const scope = await getScope();
  const r = await prisma.recipe.findFirst({ where: { id, businessId: scope.businessId } });
  if (!r) throw new Error("Not found");
  // RecipeIngredient cascades on Recipe delete (set in schema)
  await prisma.recipe.delete({ where: { id } });
  await writeAudit({ businessId: scope.businessId, userId: scope.userId, action: "recipe.delete", entityType: "Recipe", entityId: id, diff: { name: r.name } });
  revalidatePath("/recipes");
}
