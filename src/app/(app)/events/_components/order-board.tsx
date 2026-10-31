import Link from "next/link";
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

  Dark ground, because the board is meant to be read across a stall at night
  and that is the one screen in the system that is dark end to end.
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
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {COLUMNS.map((col) => {
        const rows = events.filter((e) => col.statuses.includes(e.status));
        return (
          <section key={col.key} className="min-w-0">
            <header className="mb-3 flex items-baseline justify-between gap-2 px-1">
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

            <div className="flex flex-col gap-3">
              {rows.map((e) => (
                <Ticket key={e.id} event={e} />
              ))}
              {rows.length === 0 && (
                <p className="rounded-[22px] border border-dashed border-white/15 px-4 py-6 text-center text-xs text-board-dim">
                  Nothing here.
                </p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Ticket({ event }: { event: BoardEvent }) {
  const { status, column } = event;
  const profit = column?.profitCents ?? 0;
  const traded = (column?.txns ?? 0) > 0;

  return (
    <Link
      href={`/events/${event.id}`}
      className={cn(
        "block rounded-[22px] border p-4 transition-colors",
        /*
          The board's ticket tints: a loss is the late ticket, stocking up is
          the one being worked on, a profitable event is ready to hand off.

          Every opacity here is a multiple of five. Tailwind's scale steps in
          fives and silently emits NOTHING for a value off it — these were /12
          and /16, so a loss ticket rendered with no red at all and the hover
          states did nothing. Confirmed by grepping the compiled stylesheet:
          zero rules for each. tests/unit/tailwind-opacity.test.ts now fails the
          build rather than letting it happen a third time.
        */
        status === "loss" && "border-board-red/45 bg-board-red/15 hover:bg-board-red/20",
        status === "stocked" && "border-board-amber/40 bg-board-amber/10 hover:bg-board-amber/15",
        status === "profit" && "border-board-green/40 bg-board-green/10 hover:bg-board-green/15",
        (status === "upcoming" || status === "none") &&
          "border-white/15 bg-white/5 hover:bg-white/10",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
            style={{ background: event.color ?? "rgba(255,255,255,.4)" }}
          />
          <span className="display-num truncate text-[17px] font-medium text-board-ink" title={event.name}>
            {event.name}
          </span>
        </span>
        <span
          className={cn(
            "num shrink-0 rounded-full px-2 py-0.5 text-2xs font-semibold",
            // /15 not /25 on the red: the tint lightens the ground under an
            // already-light label, and at /25 "Lost money" measured 4.37:1.
            status === "loss" && "bg-board-red/15 text-board-red",
            status === "stocked" && "bg-board-amber/15 text-board-amber",
            status === "profit" && "bg-board-green/15 text-board-green",
            (status === "upcoming" || status === "none") && "bg-white/10 text-board-dim",
          )}
        >
          {STATUS_LABELS[status]}
        </span>
      </div>

      <div className="mt-1.5 text-xs text-board-dim">
        {fmtDate(event.startDate, "MMM d")}
        {event.endDate.getTime() !== event.startDate.getTime() && (
          <> – {fmtDate(event.endDate, "MMM d, yyyy")}</>
        )}
        {event.feeCents > 0 && <> · fee {formatMoney(event.feeCents)}</>}
      </div>

      {/* The ticket's lines. An event that has not traded shows what has gone
          out on it instead of a profit that is really a cost allocation. */}
      <dl className="mt-3 space-y-1 border-t border-white/10 pt-3 text-[13px]">
        {traded ? (
          <>
            <Line label="Net sales" value={formatMoney(column?.netSalesCents ?? 0)} />
            <Line
              label="Profit"
              value={formatMoney(profit, { signed: true })}
              tone={profit < 0 ? "text-board-red" : profit > 0 ? "text-board-green" : undefined}
              strong
            />
            <Line label="Margin" value={formatPercent(column?.marginPct ?? 0)} />
          </>
        ) : (
          <>
            <Line label="Spent so far" value={formatMoney(event.ownSpendCents)} />
            <Line label="Sold" value="Nothing yet" />
          </>
        )}
      </dl>
    </Link>
  );
}

function Line({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: string;
  tone?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-board-dim">{label}</dt>
      <dd className={cn("num", strong && "font-semibold", tone ?? "text-board-ink")}>{value}</dd>
    </div>
  );
}
