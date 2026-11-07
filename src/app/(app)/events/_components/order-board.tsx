import { EventMark } from "@/components/event-mark";
import Link from "next/link";
import { SwipePager } from "@/components/swipe-pager";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/date";
import { formatMoney, formatPercent } from "@/lib/money";
import type { PnlColumn } from "@/modules/reports/queries";
import { STATUS_LABELS, type EventStatus } from "@/modules/events/status";

/*
  Events as the handoff's orders board (screen 1h).

  The KDS lays tickets out in columns by where an order has got to — queued,
  being made, ready — and tints a ticket by how it is doing. An event moves
  through the same shape: booked, stocked up, traded. So the columns are the
  event statuses the app already computes, and a ticket is one event.

  Its ground follows the theme (globals.css, --board-*), so in light mode it
  is a white card on the canvas and in dark mode an olive one.
*/

export type BoardEvent = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  color: string | null;
  feeCents: number;
  status: EventStatus;
  ownSpendCents: number;
  column: PnlColumn | null;
};

type ColumnDef = {
  key: string;
  title: string;
  statuses: EventStatus[];
};

const COLUMNS: ColumnDef[] = [
  { key: "booked", title: "Booked", statuses: ["upcoming"] },
  { key: "stocked", title: "Stocked up", statuses: ["stocked"] },
  { key: "settled", title: "Traded", statuses: ["profit", "loss", "none"] },
];

export function OrderBoard({ events }: { events: BoardEvent[] }) {
  const groups = COLUMNS.map((col) => ({ col, rows: events.filter((e) => col.statuses.includes(e.status)) }));
  // Open on the first column that has something in it, so a phone never lands
  // on "Nothing here."
  const first = Math.max(0, groups.findIndex((g) => g.rows.length > 0));
  return (
    <SwipePager
      tone="board"
      initial={first}
      tabs={groups.map((g) => ({ key: g.col.key, label: g.col.title, count: g.rows.length }))}
      panes={groups.map(({ col, rows }) => (
        <section key={col.key} className="min-w-0">
          {/* The tab strip names the column on a phone; the heading is for the
              side-by-side layout. */}
          <header className="mb-3 hidden items-baseline justify-between gap-2 px-1 lg:flex">
            <h2
              className={cn(
                "text-xs font-semibold uppercase tracking-[0.1em]",
                col.key === "booked" && "text-board-dim",
                col.key === "stocked" && "text-board-amber",
                col.key === "settled" && "text-board-green",
              )}
            >
              {col.title}
            </h2>
            <span className="num text-2xs text-board-dim">
              {rows.length} event{rows.length === 1 ? "" : "s"}
            </span>
          </header>

          {/* One line per event in one quiet list: tile, name and date, the
              figure that matters, and a status dot. Tap for the event. */}
          {rows.length > 0 ? (
            <ul className="divide-y divide-board-ink/10 overflow-hidden rounded-[22px] bg-board-ink/5">
              {rows.map((e) => (
                <li key={e.id}><Ticket event={e} /></li>
              ))}
            </ul>
          ) : (
            <p className="rounded-[22px] border border-dashed border-board-ink/15 px-4 py-6 text-center text-xs text-board-dim">
              Nothing here.
            </p>
          )}
        </section>
      ))}
    />
  );
}

function Ticket({ event }: { event: BoardEvent }) {
  const { status, column } = event;
  const profit = column?.profitCents ?? 0;
  const traded = (column?.txns ?? 0) > 0;

  const tone =
    status === "loss" ? "text-board-red" : status === "profit" ? "text-board-green" : status === "stocked" ? "text-board-amber" : "text-board-dim";
  return (
    <Link
      href={`/events/${event.id}`}
      className="lg-press flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-board-ink/5"
    >
      <EventMark name={event.name} size="md" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium leading-tight text-board-ink" title={event.name}>
          {event.name}
        </span>
        <span className="mt-0.5 block truncate text-xs text-board-dim">
          {fmtDate(event.startDate, "MMM d")}
          {event.endDate.getTime() !== event.startDate.getTime() && <> – {fmtDate(event.endDate, "MMM d")}</>}
          {!traded && event.ownSpendCents > 0 && <> · {formatMoney(event.ownSpendCents)} spent</>}
          {event.feeCents > 0 && <> · fee {formatMoney(event.feeCents)}</>}
        </span>
      </span>
      <span className="shrink-0 text-right">
        {traded ? (
          <>
            <span className={cn("num block text-[15px] font-semibold", tone)}>{formatMoney(profit, { signed: true })}</span>
            <span className="num block text-[11px] text-board-dim">{formatPercent(column?.marginPct ?? 0)}</span>
          </>
        ) : (
          <span className={cn("block text-xs font-medium", tone)}>{STATUS_LABELS[status]}</span>
        )}
      </span>
    </Link>
  );
}
