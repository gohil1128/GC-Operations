/*
  Menu-item categories.

  These used to be God's Chai's menu, written into the product. The normaliser
  did not merely SUGGEST those names, it rewrote other people's: any category
  containing "hot" became "Hot Chai", anything with "cold" became "Cold Chais".
  A bakery importing "Hot Drinks" and "Cold Brew" from Square would have had
  both renamed after somebody else's menu, and the wrong names would then be
  what their dashboard, their item mix and their CSV exports all said.

  A business's categories are its own. They come from the till, and the only
  rules applied here are ones that hold whatever the business sells.
*/

/*
  The two buckets every business needs regardless of its menu.

  Tips is not a menu category — it is the bucket that keeps gratuity out of
  revenue analysis, which matters to a florist as much as a chai stall. Other
  is where a till's blank and "Uncategorized" lines land.

  Everything else is discovered from the business's own items; there is no
  preset list of food to pick from, because there is no list that fits
  everybody.
*/
export const UNIVERSAL_CATEGORIES = ["Tips", "Other"] as const;

/** Kept for the places that want a minimum set to offer. */
export const ITEM_CATEGORIES = UNIVERSAL_CATEGORIES;

export type ItemCategory = string;

/*
  Anchored at the END, not merely word-bounded.

  A plain includes("tip") caught "Tip Top Bakery"; so did a word boundary,
  because Tip is a whole word there. Requiring the string to END in the word
  keeps the qualifiers a till really does emit — "Staff Tips", "Card Tip" — and
  leaves the bakery alone.

  The asymmetry is deliberate. Misfiling real revenue as gratuity removes it
  from every margin on the dashboard; missing an oddly-named tip line only
  leaves it in with the sales, where an operator can see and recategorise it.
*/
const TIP_LIKE = /^(?:.*\s)?(?:tips?|gratuit(?:y|ies))$/i;
const NOTHING_SET = /^(uncategori[sz]ed|none|n\/a|-)$/i;

/**
 * The category to group an item under.
 *
 * Whatever the till sent, trimmed — not translated. The only changes made are
 * the two that are true for any business: gratuity lines are pulled out as
 * Tips, and a blank or "Uncategorized" becomes Other so the rollups have
 * somewhere to put them.
 */
export function normalizeCategory(category: string | null, itemName?: string): string {
  const raw = (category ?? "").trim();
  const name = (itemName ?? "").trim();

  // The item's own name wins for gratuity: tills often leave these
  // uncategorised, and counting them as sales overstates every margin.
  if (TIP_LIKE.test(name)) return "Tips";
  if (TIP_LIKE.test(raw)) return "Tips";

  if (!raw || NOTHING_SET.test(raw)) return "Other";

  return raw;
}

/*
  A category's colour.

  This was keyword-matched too — hot was red, cold was the brand colour, and
  anything else was grey. For a business whose categories are not chai, that
  meant every dot on the page was the same grey and the item list carried no
  colour information at all.

  Now any category gets a colour, chosen by hashing its name so it is stable:
  "Pastries" is the same colour on the sales page, in the item editor and
  tomorrow. Tailwind cannot build class names at runtime, so these are whole
  class strings picked from a fixed list rather than composed.
*/
const CATEGORY_PALETTE = [
  { dot: "bg-destructive", text: "text-destructive", bar: "bg-destructive" },
  { dot: "bg-brand", text: "text-brand", bar: "bg-brand" },
  { dot: "bg-warning", text: "text-warning", bar: "bg-warning" },
  { dot: "bg-chart-ink", text: "text-chart-ink", bar: "bg-chart-ink" },
  { dot: "bg-amber", text: "text-amber", bar: "bg-amber" },
  { dot: "bg-success", text: "text-success", bar: "bg-success" },
] as const;

const MUTED = {
  dot: "bg-muted-foreground/50",
  text: "text-muted-foreground",
  bar: "bg-muted-foreground/50",
} as const;

/** Stable small hash — same name, same colour, on every page and every render. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function categoryStyle(category: string | null) {
  const c = normalizeCategory(category);
  // The two universal buckets keep fixed meanings: Tips is money that is not
  // revenue, Other is "we do not know", and neither should borrow a menu
  // category's colour.
  if (c === "Tips") return CATEGORY_PALETTE[5];
  if (c === "Other") return MUTED;
  return CATEGORY_PALETTE[hash(c.toLowerCase()) % (CATEGORY_PALETTE.length - 1)];
}

/**
 * The categories a business actually uses, for a picker.
 *
 * Built from their own items rather than a preset list, plus the two universal
 * buckets so Tips and Other are always offered even before anything lands in
 * them.
 */
export function categoriesInUse(categories: readonly (string | null)[]): string[] {
  const seen = new Set<string>(UNIVERSAL_CATEGORIES);
  for (const c of categories) {
    const n = normalizeCategory(c);
    if (n) seen.add(n);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}
