import type { PnlColumn } from "@/modules/reports/queries";

/*
  What kind of number an event's card is actually showing.

  The distinction that matters: an event with money spent against it and no
  transactions has not performed badly — nothing has happened yet. That is
  stock bought up front, and it sat in the list looking identical to an event
  that traded and lost money. One is a purchase; the other is a problem.
*/

export const EVENT_STATUSES = ["upcoming", "stocked", "profit", "loss", "none"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export function eventStatus(
  column: PnlColumn | null,
  event: { startDate: Date; endDate: Date },
  now: Date,
  /*
    Spend tagged to this event alone — NOT the P&L column's cost lines, which
    include each event's 1/N share of invoices flagged "applies to all
    events". Every event carries some of that from the moment it exists, so
    reading spend off the column marked brand-new events as stocked up.
  */
  ownSpendCents: number,
): EventStatus {
  const txns = column?.txns ?? 0;
  const profit = column?.profitCents ?? 0;

  // Nothing sold yet. If money has gone out on it anyway, that is stock-up
  // spend — true whether or not the date has passed, since an event can be
  // bought for weeks ahead. Checked before the date so a stocked-up future
  // event reads as stocked rather than merely upcoming.
  if (txns === 0) {
    if (ownSpendCents > 0) return "stocked";
    return event.endDate >= now ? "upcoming" : "none";
  }

  if (profit > 0) return "profit";
  if (profit < 0) return "loss";
  return "none";
}

export const STATUS_LABELS: Record<EventStatus, string> = {
  upcoming: "Upcoming",
  stocked: "Pre-purchased inventory",
  profit: "Profitable",
  loss: "Lost money",
  none: "No activity",
};

/** Filter segments, in the order they appear above the list. */
export const EVENT_FILTERS = [
  { key: "all", label: "All" },
  { key: "profit", label: "Profitable" },
  { key: "loss", label: "Lost money" },
  { key: "stocked", label: "Stocked up" },
  { key: "upcoming", label: "Upcoming" },
] as const;

export type EventFilter = (typeof EVENT_FILTERS)[number]["key"];

export function matchesFilter(status: EventStatus, filter: EventFilter): boolean {
  return filter === "all" || status === filter;
}
