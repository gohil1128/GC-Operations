import { EventMark, eventInitials } from "@/components/event-mark";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatMoneyHeadline, formatPercent } from "@/lib/money";

/*
  The reference's "Portfolio" grid, where each holding is an event.

  This is the part of the design that fits the business best. A pop-up's
  money is organised by event the way a portfolio's is by position, and the
  question both ask is the same: which ones are carrying the rest. So each
  card is one event's net sales with its margin in a chip, and one card is
  picked out — the event the page is scoped to, or the top earner when it is
  not scoped — in highlight, as the reference picks out one holding in lime.

  Margins come from the P&L columns the statement below is built from, so a
  card and the statement can never disagree, and they are absent (not
  zeroed) when the section is locked.
*/

export type EventCard = {
  id: string;
  name: string;
  color: string | null;
  netSalesCents: number;
  marginPct: number | null;
};

export function EventCards({ events, highlightId }: { events: EventCard[]; highlightId: string | null }) {
  return (
    <section aria-labelledby="events-heading">
      <div className="flex items-baseline justify-between">
        <h2 id="events-heading" className="font-display text-xl font-semibold tracking-[-0.01em]">
          Your events
        </h2>
        <Link
          href="/events"
          className="relative text-sm font-medium text-muted-foreground after:absolute after:-inset-x-2 after:-inset-y-3 after:content-[''] hover:text-foreground"
        >
          View all
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="mt-3 rounded-3xl bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Nothing is tagged to an event yet. Tag a night&apos;s sales and invoices to an event and
            each one gets a card here.
          </p>
          <Link
            href="/events"
            className="lg-press mt-4 inline-flex h-11 items-center rounded-full bg-foreground px-5 text-sm font-semibold text-background"
          >
            Go to events
          </Link>
        </div>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {events.map((e) => {
            const lit = e.id === highlightId;
            return (
              <li key={e.id}>
                <Link
                  href={`/events/${e.id}`}
                  className={cn(
                    "lg-press flex h-full flex-col rounded-3xl p-4",
                    lit ? "bg-highlight text-highlight-foreground" : "bg-card",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    {lit ? (
                      <span aria-hidden className="grid h-9 min-w-9 shrink-0 place-items-center rounded-xl bg-highlight-foreground px-1 text-[13px] font-bold text-highlight">
                        {eventInitials(e.name)}
                      </span>
                    ) : (
                      <EventMark name={e.name} size="lg" className="h-9 min-w-9 text-[13px]" />
                    )}
                    <span className="min-w-0 line-clamp-2 break-words text-[13.5px] font-semibold leading-tight" title={e.name}>
                      {e.name}
                    </span>
                  </div>
                  <div className="display-num mt-4 text-[22px] font-medium tabular-nums tracking-[-0.02em]">
                    {formatMoneyHeadline(e.netSalesCents)}
                  </div>
                  <div className={cn("mt-1 text-xs", lit ? "text-highlight-foreground/80" : "text-muted-foreground")}>
                    {e.marginPct === null ? "Net sales" : `${formatPercent(e.marginPct)} margin`}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
