import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { requireCapability } from "@/lib/scope";
import { listEventsWithTotals } from "@/modules/events/detail";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/mobile-list";
import { cn } from "@/lib/utils";
import { EVENT_FILTERS, eventStatus, matchesFilter, type EventFilter } from "@/modules/events/status";
import { OrderBoard } from "./_components/order-board";

export const dynamic = "force-dynamic";

// Pick-an-event index. Each card opens everything recorded against that event.
export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, scope] = await Promise.all([searchParams, requireCapability("events")]);
  const all = await listEventsWithTotals(scope.businessId, scope.locationId);
  const now = new Date();

  const raw = Array.isArray(params.show) ? params.show[0] : params.show;
  const filter: EventFilter =
    (EVENT_FILTERS.find((f) => f.key === raw)?.key as EventFilter) ?? "all";

  const classified = all.map((r) => ({
    ...r,
    status: eventStatus(r.column, r.event, now, r.ownSpendCents),
  }));
  const counts = classified.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  const rows = classified.filter((r) => matchesFilter(r.status, filter));

  return (
    <div>
      <PageHeader
        eyebrow="Events"
        title="Events"
        description="Pick an event to see everything recorded against it — sales, items, invoices, fees, labor and cash."
      />
      <div className="mx-auto max-w-[1400px] px-4 pb-12 pt-4 sm:px-6 lg:px-8">
        {all.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            {EVENT_FILTERS.map((f) => {
              const n = f.key === "all" ? all.length : (counts[f.key] ?? 0);
              const active = filter === f.key;
              return (
                <Link
                  key={f.key}
                  href={f.key === "all" ? "/events" : `/events?show=${f.key}`}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "touch-target inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
                    active
                      ? "border-espresso bg-espresso font-semibold text-espresso-foreground"
                      : "border-input bg-card text-secondary-foreground hover:bg-accent",
                    // A segment that would show nothing still renders, so the
                    // set of filters doesn't shift around as data changes —
                    // but it says up front that it is empty.
                    n === 0 && !active && "opacity-55",
                  )}
                >
                  {f.label}
                  <span className={cn("num text-2xs", active ? "opacity-80" : "text-muted-foreground")}>{n}</span>
                </Link>
              );
            })}
          </div>
        )}

        {all.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="h-5 w-5" />}
            title="No events yet"
            description="Add an event in Settings, then tag sales and invoices to it to build its P&L."
            action={
              <Link
                href="/settings"
                className="rounded-full bg-espresso px-4 py-2 text-sm text-espresso-foreground"
              >
                Go to Settings
              </Link>
            }
          />
        ) : (
          /*
            The orders board. Kept inside the page's existing data and filter
            bar — the board is the layout, not a different screen.
          */
          <div className="rounded-[28px] bg-board-ground p-4 shadow-[0_18px_40px_-26px_hsl(var(--ink-950)/0.7)] sm:p-5">
            <OrderBoard
              events={rows.map(({ event, column, status, ownSpendCents }) => ({
                id: event.id,
                name: event.name,
                startDate: event.startDate,
                endDate: event.endDate,
                color: event.color,
                feeCents: event.feeCents,
                status,
                ownSpendCents,
                column,
              }))}
            />
          </div>
        )}
      </div>
    </div>
  );
}
