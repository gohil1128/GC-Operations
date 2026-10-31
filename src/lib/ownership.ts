import { prisma } from "@/lib/prisma";

/*
  Ownership checks for ids that arrive from the client.

  A Server Action that writes `supplierId: parsed.supplierId` straight into a
  row is trusting the caller to name something they own. Today that holds
  because there is one business; the moment a second one exists on the same
  deployment it does not, and the consequences are not just a read:

    createPoAction accepted any ingredientId, and receivePoAction then ran
    `tx.ingredient.update({ where: { id } })` on it — incrementing onHand and
    overwriting avgCostCents on a row belonging to somebody else. Their
    inventory valuation, variance report, plate costs and food-cost percentage
    all move, with the audit entry filed under the attacker's business.

  Every foreign key here (Supplier, Ingredient, Event, Employee, Vendor) hangs
  off Business, so one question answers all of them: does this id belong to the
  caller's business? These helpers ask it in one query and throw if not.

  They throw rather than returning an error because a failed ownership check is
  never an ordinary outcome to render — the id did not come from any screen the
  caller can see, so there is nothing useful to say beyond "not found".
*/

type Model = "supplier" | "ingredient" | "event" | "employee" | "vendor";

const LABEL: Record<Model, string> = {
  supplier: "Supplier",
  ingredient: "Ingredient",
  event: "Event",
  employee: "Employee",
  vendor: "Vendor",
};

/**
 * Check one optional foreign key. Returns the id when it belongs to this
 * business, null when it was absent, and throws when it names something else.
 */
export async function ownedId(
  model: Model,
  businessId: string,
  id: string | null | undefined,
): Promise<string | null> {
  const trimmed = typeof id === "string" ? id.trim() : "";
  if (!trimmed) return null;

  // `as any` because Prisma's delegate map is not indexable by a union without
  // generating a type per model; the model names are a closed set above.
  const row = await (prisma as any)[model].findFirst({
    where: { id: trimmed, businessId },
    select: { id: true },
  });
  if (!row) throw new Error(`${LABEL[model]} not found`);
  return trimmed;
}

/** Same, for a key that must be present. */
export async function requiredOwnedId(
  model: Model,
  businessId: string,
  id: string | null | undefined,
): Promise<string> {
  const ok = await ownedId(model, businessId, id);
  if (!ok) throw new Error(`${LABEL[model]} is required`);
  return ok;
}

/**
 * Check a whole set at once — one query rather than one per line item, so a
 * fifty-line purchase order does not become fifty round trips.
 */
export async function assertAllOwned(
  model: Model,
  businessId: string,
  ids: readonly (string | null | undefined)[],
): Promise<void> {
  const wanted = [...new Set(ids.map((i) => (typeof i === "string" ? i.trim() : "")).filter(Boolean))];
  if (wanted.length === 0) return;

  const rows = await (prisma as any)[model].findMany({
    where: { id: { in: wanted }, businessId },
    select: { id: true },
  });
  if (rows.length !== wanted.length) {
    // Deliberately does not name which id failed: the caller supplied them, so
    // telling them which one exists elsewhere is itself a small oracle.
    throw new Error(`${LABEL[model]} not found`);
  }
}
