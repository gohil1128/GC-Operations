import { describe, it, expect } from "vitest";
import {
  OVERVIEW_CARDS, OVERVIEW_CARD_KEYS, isCardVisible, sanitiseHiddenCards,
  type OverviewCardKey,
} from "@/modules/dashboard/cards";

/*
  Per-business Overview personalisation.

  The storage direction is the load-bearing decision here: the column holds the
  cards a business has turned OFF. Stored the other way round, every card added
  after today would be invisible to every existing business until each of them
  went and ticked it — and nobody would.
*/

describe("the card registry", () => {
  it("has unique keys", () => {
    expect(new Set(OVERVIEW_CARD_KEYS).size).toBe(OVERVIEW_CARD_KEYS.length);
  });

  it("gives every card a label and a blurb a person can act on", () => {
    for (const c of OVERVIEW_CARDS) {
      expect(c.label.length, c.key).toBeGreaterThan(2);
      expect(c.blurb.length, c.key).toBeGreaterThan(10);
    }
  });
});

describe("isCardVisible", () => {
  it("shows everything for a business that has chosen nothing", () => {
    for (const k of OVERVIEW_CARD_KEYS) {
      expect(isCardVisible([], k as OverviewCardKey), k).toBe(true);
      expect(isCardVisible(null, k as OverviewCardKey), k).toBe(true);
      expect(isCardVisible(undefined, k as OverviewCardKey), k).toBe(true);
    }
  });

  it("hides exactly what was turned off, and nothing else", () => {
    expect(isCardVisible(["itemMix"], "itemMix")).toBe(false);
    expect(isCardVisible(["itemMix"], "pnl")).toBe(true);
  });

  /*
    The reason for storing hidden keys rather than visible ones: a card that
    does not exist yet must default to ON for businesses that saved their
    preferences before it was written.
  */
  it("shows a newly added card to a business that saved its choices earlier", () => {
    const savedBeforeThisCardExisted = ["itemMix", "upcomingEvents"];
    // "revenueByEvent" stands in for whatever gets added next.
    expect(isCardVisible(savedBeforeThisCardExisted, "revenueByEvent")).toBe(true);
  });
});

describe("sanitiseHiddenCards", () => {
  it("keeps the keys this version knows", () => {
    expect(sanitiseHiddenCards(["pnl", "itemMix"])).toEqual(["pnl", "itemMix"]);
  });

  it("drops anything it does not recognise", () => {
    // A card removed from the registry, or a hand-posted value.
    expect(sanitiseHiddenCards(["pnl", "cardThatWasDeleted", "../../etc"])).toEqual(["pnl"]);
  });

  it("copes with an absent column", () => {
    expect(sanitiseHiddenCards(null)).toEqual([]);
    expect(sanitiseHiddenCards(undefined)).toEqual([]);
    expect(sanitiseHiddenCards([])).toEqual([]);
  });
});

describe("the dashboard honours every key in the registry", () => {
  it("has a show() guard for each card", async () => {
    const { readFileSync } = await import("node:fs");
    const page = readFileSync("src/app/(app)/dashboard/page.tsx", "utf8");
    for (const key of OVERVIEW_CARD_KEYS) {
      expect(page, `dashboard never checks show("${key}")`).toContain(`show("${key}")`);
    }
  });

  it("offers every registry card in the settings control", async () => {
    const { readFileSync } = await import("node:fs");
    const card = readFileSync("src/app/(app)/settings/_components/overview-cards-card.tsx", "utf8");
    // Rendered from the registry itself, so the list cannot drift out of step.
    expect(card).toContain("OVERVIEW_CARDS.map");
  });
});
