/*
  Which cards a business wants on its Overview.

  The page was one fixed layout for everybody. A caterer who never runs an
  inventory count and a market stall with no staff were shown the same seven
  sections, and the two or three that mattered to them were buried among the
  ones that did not.

  Stored as the cards a business has turned OFF, not the ones it has turned on.
  That choice decides what happens to the NEXT card added to this file: with a
  list of hidden keys it appears for everyone and can be dismissed, which is
  what you want. With a list of visible keys it would be invisible to every
  existing business until each of them went and ticked it, and nobody would.

  Deliberately a per-business setting rather than per-user: the owner decides
  what the business looks at, the same way the section PIN and the cost targets
  work. Per-user preferences are a different feature with a different shape.
*/

export const OVERVIEW_CARDS = [
  {
    key: "kpis",
    label: "Headline figures",
    blurb: "Net sales, profit, open invoices and average ticket.",
  },
  {
    key: "pnl",
    label: "Profit & loss statement",
    blurb: "A column per event, with the totals beside them.",
  },
  {
    key: "topItems",
    label: "What sold",
    blurb: "The best sellers for the chosen event.",
  },
  {
    key: "invoicesDue",
    label: "Invoices due",
    blurb: "Supplier bills still open, oldest first.",
  },
  {
    key: "upcomingEvents",
    label: "Upcoming events",
    blurb: "The next markets in the diary.",
  },
  {
    key: "revenueByEvent",
    label: "Revenue by event",
    blurb: "One bar per event, with what it cost to earn.",
  },
  {
    key: "itemMix",
    label: "Item mix",
    blurb: "The split of what sold, by category.",
  },
] as const;

export type OverviewCardKey = (typeof OVERVIEW_CARDS)[number]["key"];

export const OVERVIEW_CARD_KEYS: readonly string[] = OVERVIEW_CARDS.map((c) => c.key);

/**
 * Is this card shown for this business?
 *
 * Unknown keys in the stored list are ignored rather than trusted — a card
 * removed from this file would otherwise leave a value behind that quietly
 * matches nothing, and a hand-edited row should not be able to hide anything
 * that does not exist.
 */
export function isCardVisible(hidden: readonly string[] | null | undefined, key: OverviewCardKey) {
  return !(hidden ?? []).includes(key);
}

/** The stored list, with anything this version does not recognise dropped. */
export function sanitiseHiddenCards(raw: readonly string[] | null | undefined): OverviewCardKey[] {
  return (raw ?? []).filter((k): k is OverviewCardKey => OVERVIEW_CARD_KEYS.includes(k));
}
