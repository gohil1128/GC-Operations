import { INVOICE_CATEGORIES } from "@/lib/gc-categories";

/*
  Which supplier bills are a cost of goods and which are a cost of trading.

  Every invoice used to land in COGS. All of it — the venue fee, the flyers,
  a new urn, the month's rent. On $15,682 of sales and $10,122 of invoices
  that read as a 20.2% margin, and the business was doing considerably better
  than that: $1,442 of what was being charged against the chai had nothing to
  do with making any.

  It matters beyond the headline. Gross margin is the number that says whether
  the recipe works, and it only says that if the things subtracted from
  revenue are things that were consumed producing it. Rent does not move when
  you sell one more cup; it belongs below the gross-profit line with labour
  and the booth fee, where it is a cost of being open rather than a cost of
  selling.

  The split is per business because the honest answer is not universal. Cups
  and lids go out of the door with every drink, which is textbook cost of
  sales, and this default treats them that way — but a business that buys
  packaging in bulk once a year and would rather see it as overhead is not
  wrong, and gets to say so. What is not negotiable is that rent and marketing
  are not the cost of a chai.

  Anything not named here — an uncategorised invoice, or a category a business
  invented — stays in cost of goods, which is where it already was. An unknown
  bill quietly moving out of COGS would improve the margin without anybody
  deciding it should, and a figure that flatters you for no reason is worse
  than the one that was too harsh.
*/

/** Categories treated as operating expense unless a business says otherwise. */
export const DEFAULT_OPEX_INVOICE_CATEGORIES: readonly string[] = [
  "Rent / Venue",
  "Marketing",
  "Equipment & Smallwares",
  "Repairs & Maintenance",
  "Cleaning",
];

/** The other side of the same list, for a settings screen to offer. */
export const CLASSIFIABLE_INVOICE_CATEGORIES: readonly string[] = INVOICE_CATEGORIES.filter(
  (c) => c !== "Other",
);

/*
  Matching is case- and space-insensitive on purpose. The column is free text
  so that a preset being renamed never orphans what is already saved, which
  means "Rent / Venue", "rent/venue" and "Rent/Venue" all exist in the wild
  and all mean the same bill.
*/
function normalise(category: string): string {
  return category.toLowerCase().replace(/\s+/g, "");
}

export type CostClass = "cogs" | "opex";

/**
 * Where one invoice belongs, given the business's list of operating-expense
 * categories. Pass the stored list; an empty one means everything is COGS,
 * which is exactly what a business that has opted out should get.
 */
export function classifyInvoice(
  category: string | null | undefined,
  opexCategories: readonly string[],
): CostClass {
  if (!category) return "cogs";
  const want = normalise(category);
  return opexCategories.some((c) => normalise(c) === want) ? "opex" : "cogs";
}

/**
 * Splits a set of invoices into the two buckets in one pass.
 * Generic over the row so callers can hand it whatever they selected.
 */
export function splitInvoiceCosts<T extends { category?: string | null; totalCents: number }>(
  invoices: readonly T[],
  opexCategories: readonly string[],
): { cogsCents: number; opexCents: number } {
  let cogsCents = 0;
  let opexCents = 0;
  for (const inv of invoices) {
    if (classifyInvoice(inv.category, opexCategories) === "opex") opexCents += inv.totalCents;
    else cogsCents += inv.totalCents;
  }
  return { cogsCents, opexCents };
}
