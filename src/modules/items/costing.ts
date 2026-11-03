import { prisma } from "@/lib/prisma";
import { convertUnits } from "@/lib/units";

/*
  What one sold unit costs to make.

  Built from the recipe's bill of materials, the same arithmetic the recipes
  screen already shows as plate cost — so an ingredient price moving is
  reflected in every margin without anybody retyping a number, which is the
  whole reason for costing from recipes rather than a figure typed per item.

  One difference from the recipes screen, and it matters: plate cost there is
  the cost of one whole yield. A recipe that yields 12 has a plate cost twelve
  units of ingredients deep, so the cost of ONE sold unit is that divided by
  the yield. Dividing is what makes this comparable to a unit's selling price.
*/

function bomLineCents(ri: {
  qty: number;
  unit: string;
  ingredient: { unit: string; avgCostCents: number };
}): number {
  const conv = convertUnits(ri.qty, ri.unit, ri.ingredient.unit);
  const effectiveQty = conv !== null ? conv : ri.qty;
  return Math.round(effectiveQty * ri.ingredient.avgCostCents);
}

export type ItemCost = {
  recipeId: string;
  recipeName: string;
  /** Cost of one sold unit, i.e. the whole batch divided by its yield. */
  unitCostCents: number;
  /** True when the recipe exists but has no ingredients priced against it. */
  unpriced: boolean;
};

/** item name (lowercased) → what one of it costs, for every linked item. */
export async function getItemCosts(locationId: string): Promise<Map<string, ItemCost>> {
  const links = await prisma.itemRecipeLink.findMany({
    where: { locationId },
    include: {
      recipe: {
        include: { ingredients: { include: { ingredient: true } } },
      },
    },
  });

  const out = new Map<string, ItemCost>();
  for (const link of links) {
    const r = link.recipe;
    const batchCents = r.ingredients.reduce((acc, ri) => acc + bomLineCents(ri), 0);
    // yieldQty is validated above zero on the way in, but a bad row must not
    // turn into a division by zero that silently reports an infinite margin.
    const yieldQty = r.yieldQty > 0 ? r.yieldQty : 1;
    out.set(link.itemName.toLowerCase(), {
      recipeId: r.id,
      recipeName: r.name,
      unitCostCents: Math.round(batchCents / yieldQty),
      unpriced: batchCents === 0,
    });
  }
  return out;
}

/** The links themselves, for the editor. */
export async function listItemRecipeLinks(locationId: string) {
  return prisma.itemRecipeLink.findMany({
    where: { locationId },
    select: { itemName: true, recipeId: true },
  });
}
