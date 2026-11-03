import { describe, it, expect } from "vitest";
import {
  DEFAULT_OPEX_INVOICE_CATEGORIES,
  CLASSIFIABLE_INVOICE_CATEGORIES,
  classifyInvoice,
  splitInvoiceCosts,
} from "@/modules/reports/cost-classes";

const DEFAULTS = DEFAULT_OPEX_INVOICE_CATEGORIES;

describe("classifyInvoice", () => {
  it("keeps the things that go into the drink in cost of goods", () => {
    for (const c of ["Ingredients & Supplies", "Beverages", "Packaging"]) {
      expect(classifyInvoice(c, DEFAULTS), c).toBe("cogs");
    }
  });

  it("takes the cost of being open out of cost of goods", () => {
    // The four the live data was wrong about, plus cleaning.
    for (const c of ["Rent / Venue", "Marketing", "Equipment & Smallwares", "Repairs & Maintenance", "Cleaning"]) {
      expect(classifyInvoice(c, DEFAULTS), c).toBe("opex");
    }
  });

  it("leaves an uncategorised bill where it already was", () => {
    // Moving unknown bills out of COGS would improve the margin without
    // anybody deciding it should.
    expect(classifyInvoice(null, DEFAULTS)).toBe("cogs");
    expect(classifyInvoice(undefined, DEFAULTS)).toBe("cogs");
    expect(classifyInvoice("", DEFAULTS)).toBe("cogs");
  });

  it("leaves a category this app has never heard of in cost of goods", () => {
    expect(classifyInvoice("Fuel for the van", DEFAULTS)).toBe("cogs");
  });

  it("matches however the category was capitalised or spaced", () => {
    // The column is free text so a preset rename never orphans saved rows,
    // which means all of these exist in real data.
    for (const written of ["Rent / Venue", "rent / venue", "Rent/Venue", "RENT / VENUE", "rent/ venue"]) {
      expect(classifyInvoice(written, DEFAULTS), written).toBe("opex");
    }
  });

  it("puts everything back in cost of goods when a business opts out", () => {
    for (const c of CLASSIFIABLE_INVOICE_CATEGORIES) {
      expect(classifyInvoice(c, []), c).toBe("cogs");
    }
  });

  it("follows the business, not the default, when it disagrees", () => {
    // A business that buys cups by the pallet once a year and reads that as
    // overhead is not wrong, and this is where it says so.
    expect(classifyInvoice("Packaging", ["Packaging"])).toBe("opex");
    expect(classifyInvoice("Rent / Venue", ["Packaging"])).toBe("cogs");
  });
});

describe("splitInvoiceCosts", () => {
  /* The shape of the reported live data: $10,122 of invoices, of which
     $1,442 was rent, marketing and equipment. */
  const invoices = [
    { category: "Ingredients & Supplies", totalCents: 800_000 },
    { category: "Packaging", totalCents: 65_100 },
    { category: "Rent / Venue", totalCents: 62_500 },
    { category: "Equipment & Smallwares", totalCents: 63_900 },
    { category: "Marketing", totalCents: 17_800 },
    { category: null, totalCents: 2_900 },
  ];

  it("charges only the goods against gross margin", () => {
    const { cogsCents, opexCents } = splitInvoiceCosts(invoices, DEFAULTS);
    expect(cogsCents).toBe(800_000 + 65_100 + 2_900);
    expect(opexCents).toBe(62_500 + 63_900 + 17_800);
  });

  it("never loses or invents a cent, whatever the list says", () => {
    const total = invoices.reduce((a, i) => a + i.totalCents, 0);
    for (const list of [[], DEFAULTS, ["Packaging"], CLASSIFIABLE_INVOICE_CATEGORIES]) {
      const { cogsCents, opexCents } = splitInvoiceCosts(invoices, list);
      expect(cogsCents + opexCents, `lost money with ${list.length} categories`).toBe(total);
    }
  });

  it("is the old behaviour exactly when nothing is classified", () => {
    const { cogsCents, opexCents } = splitInvoiceCosts(invoices, []);
    expect(cogsCents).toBe(invoices.reduce((a, i) => a + i.totalCents, 0));
    expect(opexCents).toBe(0);
  });

  it("adds up to nothing for no invoices", () => {
    expect(splitInvoiceCosts([], DEFAULTS)).toEqual({ cogsCents: 0, opexCents: 0 });
  });
});

describe("the default list", () => {
  it("only names categories the app actually offers", () => {
    for (const c of DEFAULTS) {
      expect(CLASSIFIABLE_INVOICE_CATEGORIES, `${c} is not a category`).toContain(c);
    }
  });

  it("leaves at least one category on the cost-of-goods side", () => {
    // A default that classified everything as overhead would make gross
    // margin equal to revenue, which is worse than the bug it replaced.
    expect(DEFAULTS.length).toBeLessThan(CLASSIFIABLE_INVOICE_CATEGORIES.length);
  });
});
