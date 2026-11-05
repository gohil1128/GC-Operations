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
  not scoped — in highlight, as the reference picks out one holding in marigold.

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
                    <span
                      aria-hidden
                      className={cn(
                        "relative grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-bold",
                        lit ? "bg-highlight-foreground text-highlight" : "bg-muted text-foreground",
                      )}
                    >
                      {e.name.trim().charAt(0).toUpperCase()}
                      {/* The event's own colour, as a dot on the corner — the same
                          colour it wears in the statement and the legend, so a card
                          is recognisable across the page. It was an inset ring
                          round the initial, which for the default dark colour
                          was a dark line on a dark card: nothing to see. A dot
                          with its own hairline, sitting inside a card-coloured
                          halo, reads whatever the colour is. Skipped on the lit
                          card, where marigold is already the identity. */}
                      {e.color && !lit && (
                        <span
                          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-card"
                          style={{ backgroundColor: e.color, boxShadow: "inset 0 0 0 1px hsl(var(--foreground) / 0.3)" }}
                        />
                      )}
                    </span>
                    <span className="min-w-0 truncate text-[13.5px] font-semibold" title={e.name}>
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
