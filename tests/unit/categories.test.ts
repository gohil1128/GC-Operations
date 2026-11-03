import { describe, it, expect } from "vitest";
import {
  normalizeCategory, categoryStyle, categoriesInUse, UNIVERSAL_CATEGORIES,
} from "@/modules/items/categories";

/*
  Menu categories.

  The normaliser used to rewrite other businesses' category names into God's
  Chai's menu: anything containing "hot" came back as "Hot Chai", anything with
  "cold" as "Cold Chais". That is not a cosmetic default — it is the wrong name
  in their dashboard, their item mix and their CSV exports.
*/

describe("a business keeps its own categories", () => {
  it("does not rename another menu into this one", () => {
    // Every one of these used to come back as "Hot Chai" or "Cold Chais".
    expect(normalizeCategory("Hot Drinks")).toBe("Hot Drinks");
    expect(normalizeCategory("Hot Sandwiches")).toBe("Hot Sandwiches");
    expect(normalizeCategory("Cold Brew")).toBe("Cold Brew");
    expect(normalizeCategory("Cold Cuts")).toBe("Cold Cuts");
    expect(normalizeCategory("Seafood")).toBe("Seafood");
  });

  it("passes any category through as written", () => {
    for (const c of ["Pastries", "Viennoiserie", "Tacos", "Bubble Tea", "Merch", "Flowers"]) {
      expect(normalizeCategory(c)).toBe(c);
    }
  });

  it("trims but does not retitle", () => {
    expect(normalizeCategory("  Pastries  ")).toBe("Pastries");
    // Not title-cased or lowercased: it is their label, spelled their way.
    expect(normalizeCategory("BBQ & Grill")).toBe("BBQ & Grill");
  });
});

/*
  The existing customer must not move. Their till stores exactly these strings,
  so the chai rules were no-ops for them and removing those rules changes
  nothing — which is the reason this was safe to do.
*/
describe("God's Chai's own data is untouched", () => {
  it("returns the categories already in their database, unchanged", () => {
    expect(normalizeCategory("Hot Chai")).toBe("Hot Chai");
    expect(normalizeCategory("Cold Chais")).toBe("Cold Chais");
    expect(normalizeCategory("Food")).toBe("Food");
    expect(normalizeCategory("Other")).toBe("Other");
  });
});

describe("the two universal rules", () => {
  it("pulls gratuity out of revenue however the till spells it", () => {
    expect(normalizeCategory("Tips")).toBe("Tips");
    expect(normalizeCategory("tip")).toBe("Tips");
    expect(normalizeCategory("Gratuity")).toBe("Tips");
    expect(normalizeCategory(null, "Tip")).toBe("Tips");
    expect(normalizeCategory("Uncategorized", "Gratuity")).toBe("Tips");
  });

  it("does not mistake a menu word for a gratuity", () => {
    // includes("tip") caught all of these; so did a word boundary, since Tip
    // is a whole word in "Tip Top Bakery". Matching must reach the END.
    expect(normalizeCategory("Tip Top Bakery")).toBe("Tip Top Bakery");
    expect(normalizeCategory("Multiples")).toBe("Multiples");
    expect(normalizeCategory(null, "Tiptree Jam")).toBe("Other");
    expect(normalizeCategory("Tip Jar Merch")).toBe("Tip Jar Merch");
  });

  it("still catches the qualifiers a till actually emits", () => {
    expect(normalizeCategory("Staff Tips")).toBe("Tips");
    expect(normalizeCategory("Card Tip")).toBe("Tips");
    expect(normalizeCategory(null, "Credit Card Gratuity")).toBe("Tips");
  });

  it("sends blank and 'uncategorized' to Other", () => {
    for (const c of [null, "", "   ", "Uncategorized", "Uncategorised", "none", "N/A", "-"]) {
      expect(normalizeCategory(c), String(c)).toBe("Other");
    }
  });
});

describe("categoryStyle", () => {
  it("gives every category a colour, not just the chai ones", () => {
    // Previously anything that was not hot/cold/food/tip came back grey, so a
    // bakery's whole item list was one colour.
    const styles = ["Pastries", "Bread", "Sandwiches", "Coffee"].map((c) => categoryStyle(c).dot);
    expect(styles.every((s) => !s.includes("muted"))).toBe(true);
  });

  it("is stable — the same category is the same colour every time", () => {
    expect(categoryStyle("Pastries")).toEqual(categoryStyle("Pastries"));
    expect(categoryStyle("pastries")).toEqual(categoryStyle("Pastries"));
  });

  it("keeps the meaning of the two universal buckets", () => {
    expect(categoryStyle("Tips").dot).toBe("bg-success");
    expect(categoryStyle("Other").dot).toContain("muted");
    expect(categoryStyle(null).dot).toContain("muted");
  });

  it("separates the categories a real menu would have", () => {
    // Not a guarantee for arbitrary input, but the point of hashing is that a
    // handful of ordinary names do not collapse onto one colour.
    const dots = new Set(
      ["Hot Chai", "Cold Chais", "Food", "Pastries", "Coffee"].map((c) => categoryStyle(c).dot),
    );
    expect(dots.size).toBeGreaterThanOrEqual(3);
  });
});

describe("categoriesInUse", () => {
  it("offers the business's own categories plus the universal ones", () => {
    const list = categoriesInUse(["Pastries", "Bread", "Pastries", null]);
    expect(list).toContain("Pastries");
    expect(list).toContain("Bread");
    for (const u of UNIVERSAL_CATEGORIES) expect(list).toContain(u);
  });

  it("de-duplicates and sorts, so the picker is stable", () => {
    const list = categoriesInUse(["Zucchini", "Apples", "Apples"]);
    expect(list.filter((c) => c === "Apples")).toHaveLength(1);
    expect([...list]).toEqual([...list].sort((a, b) => a.localeCompare(b)));
  });

  it("offers the universal buckets even with nothing imported yet", () => {
    expect(categoriesInUse([])).toEqual(["Other", "Tips"]);
  });
});
