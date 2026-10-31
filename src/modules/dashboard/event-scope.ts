import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/date";

/*
  What the Overview and Sales are scoped to: an event, or all of them.

  This replaces the date-range control. The business does not trade daily — it
  trades at events, with weeks of nothing in between — so "this month" and a
  custom date span answer a question nobody here asks, while quietly hiding an
  event that fell a day outside the window.

  Scoping is by TAG, never by the event's calendar dates. Sales, invoices and
  expenses carry an eventId, and that attribution routinely lands outside the
  event's own days: a catering invoice arrives a week later, a Square export
  the next morning. Narrowing to the event's dates used to throw most of it
  away — measured, it took one event from $24,564 of tagged sales to nothing.
  So the window stays wide open and the tag does the filtering.
*/

/** Wide enough to mean "everything", so the tag is the only filter. */
const ALL_TIME_START = new Date("2000-01-01T00:00:00.000Z");
const ALL_TIME_END = new Date("2100-01-01T00:00:00.000Z");

export type EventScope = {
  /** "all" or an event id — what the control shows as selected. */
  key: string;
  /** Set when one event is in focus; null means everything. */
  eventId: string | null;
  /** "All events" or the event's name. */
  label: string;
  /** The event's dates, or the span the data actually covers. */
  subLabel: string;
  start: Date;
  end: Date;
  /** True when the business has no events yet. */
  noEvents: boolean;
};

export type EventOption = { id: string; name: string; color: string | null };

export async function listEventOptions(businessId: string): Promise<EventOption[]> {
  const events = await prisma.event.findMany({
    where: { businessId },
    orderBy: { startDate: "desc" },
    select: { id: true, name: true, color: true },
  });
  return events;
}

export async function resolveEventScope(
  businessId: string,
  params: Record<string, string | string[] | undefined>,
  /* The header's event switcher writes a cookie that scopes several screens.
     An explicit ?event= in the URL wins over it. */
  activeEvent?: { id: string; name: string; startDate: Date; endDate: Date } | null,
): Promise<EventScope> {
  const raw = Array.isArray(params.event) ? params.event[0] : params.event;

  // "all" is explicit, so a link can clear the header's active event.
  if (raw === "all") {
    return allScope(businessId);
  }

  const wantedId = raw ?? activeEvent?.id ?? null;
  if (wantedId) {
    // Scoped to the business so a guessed id resolves to nothing rather than
    // leaking another tenant's event name and dates.
    const event = await prisma.event.findFirst({ where: { id: wantedId, businessId } });
    if (event) {
      const sameDay = event.endDate.getTime() === event.startDate.getTime();
      return {
        key: event.id,
        eventId: event.id,
        label: event.name,
        subLabel: sameDay
          ? fmtDate(event.startDate, "MMM d, yyyy")
          : `${fmtDate(event.startDate, "MMM d")} – ${fmtDate(event.endDate, "MMM d, yyyy")}`,
        start: ALL_TIME_START,
        end: ALL_TIME_END,
        noEvents: false,
      };
    }
  }

  return allScope(businessId);
}

async function allScope(businessId: string): Promise<EventScope> {
  const [first, last, count] = await Promise.all([
    prisma.event.findFirst({ where: { businessId }, orderBy: { startDate: "asc" } }),
    prisma.event.findFirst({ where: { businessId }, orderBy: { endDate: "desc" } }),
    prisma.event.count({ where: { businessId } }),
  ]);

  return {
    key: "all",
    eventId: null,
    label: "All events",
    subLabel:
      first && last
        ? `${count} event${count === 1 ? "" : "s"} · ${fmtDate(first.startDate, "MMM d, yyyy")} – ${fmtDate(last.endDate, "MMM d, yyyy")}`
        : "No events yet",
    // Everything, so anything recorded without an event tag is still counted
    // here rather than disappearing between the per-event views.
    start: ALL_TIME_START,
    end: ALL_TIME_END,
    noEvents: count === 0,
  };
}
