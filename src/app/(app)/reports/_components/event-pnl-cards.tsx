import { EventMark } from "@/components/event-mark";
import { cn } from "@/lib/utils";
import { formatMoney, formatPercent } from "@/lib/money";
import type { PnlColumn } from "@/modules/reports/queries";
import { BreakdownToggle } from "./breakdown-toggle";
import { PnlRow } from "@/components/pnl-row";
import { CountUp } from "@/components/count-up";

/*
  Profit and loss, one card per event.

  This was a table with a COLUMN for every event. On a phone that meant
  swiping sideways to read one event at a time, with the row labels pinned
  across half the screen, and no way to compare two events without scrolling
  back and forth and remembering the first. Eleven events was eleven screens
  wide.

  Now each event is a card you read top to bottom: what it made, what it kept,
  and — one tap away — the whole breakdown. Cards are ordered by sales, so the
  events that mattered are first, and events with nothing recorded against them
  collapse into one line instead of being a row of dashes.

  The numbers are exactly the PnlColumn the table used. Nothing is
  recalculated here; only the layout changed.
*/

const costsOf = (c: PnlColumn) => c.cogsCents + c.laborCents + c.opexCents + c.feeCents;
const hasActivity = (c: PnlColumn) => c.txns > 0 || c.netSalesCents > 0 || costsOf(c) > 0;

export function EventPnlCards({ columns }: { columns: PnlColumn[] }) {
  const overall = columns.find((c) => c.key === "overall");
  const events = columns.filter((c) => c.key !== "overall");
  const active = events.filter(hasActivity).sort((a, b) => b.netSalesCents - a.netSalesCents || a.name.localeCompare(b.name));
  const idle = events.filter((c) => !hasActivity(c));

  return (
    <div className="space-y-3">
      {overall && <PnlCard column={overall} hero />}
      {/* Every event as one line in one card: name, sales and margin, profit.
          Tap a line for its full breakdown. */}
      {active.length > 0 && (
        <ul className="divide-y divide-border-soft overflow-hidden rounded-3xl bg-card">
          {active.map((c) => {
            const loss = c.profitCents < 0;
            const hasSales = c.netSalesCents > 0;
            return (
              <PnlRow
                key={c.key}
                summary={
                  <>
                    <EventMark name={c.name} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold leading-tight" title={c.name}>{c.name}</span>
                      <span className="mt-0.5 block truncate text-xs tabular-nums text-muted-foreground">
                        Sales {formatMoney(c.netSalesCents)}
                        {hasSales && <> · {formatPercent(c.marginPct)} margin</>}
                      </span>
                    </span>
                    <span className={cn("num shrink-0 text-[15px] font-semibold tabular-nums", loss ? "text-destructive" : "text-success")}>
                      {formatMoney(c.profitCents, { signed: true })}
                    </span>
                  </>
                }
              >
                <Breakdown c={c} />
              </PnlRow>
            );
          })}
        </ul>
      )}
      {idle.length > 0 && (
        <p className="px-1 text-xs text-muted-foreground">
          Nothing recorded yet for {idle.length === 1 ? "1 event" : `${idle.length} events`}:{" "}
          {idle.map((c) => c.name).join(", ")}.
        </p>
      )}
    </div>
  );
}

/** The sales/costs bar and the ten-line statement, shared by the hero card and each row. */
function Breakdown({ c, hero = false }: { c: PnlColumn; hero?: boolean }) {
  const costs = costsOf(c);
  const loss = c.profitCents < 0;
  const hasSales = c.netSalesCents > 0;
  const spentPct = hasSales ? Math.min(100, Math.max(0, (costs / c.netSalesCents) * 100)) : 0;
  const sub = hero ? "text-highlight-foreground/80" : "text-muted-foreground";
  const line = hero ? "border-highlight-foreground/15" : "border-border-soft";
  const row = (label: string, value: React.ReactNode, opts: { strong?: boolean; faint?: boolean } = {}) => (
    <div className={cn("flex items-baseline justify-between gap-4 border-b py-2 text-[13px] last:border-b-0", line)}>
      <dt className={cn(opts.faint ? "text-xs" : "", opts.strong ? "font-semibold" : sub)}>{label}</dt>
      <dd className={cn("num text-right tabular-nums", opts.strong && "font-semibold", opts.faint && cn("text-xs", sub))}>{value}</dd>
    </div>
  );
  const minus = (cents: number) => (cents ? <>−{formatMoney(cents)}</> : "—");
  return (
    <>
      {hasSales && (
        <div className="mb-1">
          <div aria-hidden className={cn("flex h-1.5 overflow-hidden rounded-full", hero ? "bg-highlight-foreground/15" : "bg-muted")}>
            <div className={cn(hero ? "bg-highlight-foreground/35" : loss ? "bg-destructive" : "bg-foreground/25")} style={{ width: `${spentPct}%` }} />
            {!loss && <div className={cn("flex-1", hero ? "bg-highlight-foreground" : "bg-brand-ink")} />}
          </div>
          <p className={cn("mt-1.5 flex justify-between gap-3 text-[11px] tabular-nums", sub)}>
            <span>Sales {formatMoney(c.netSalesCents)}</span>
            <span>Costs {formatMoney(costs)}</span>
          </p>
        </div>
      )}
      <dl>
        {row("Transactions", c.txns.toLocaleString())}
        {row("Net sales", formatMoney(c.netSalesCents), { strong: true })}
        {row("Cost of goods", minus(c.cogsCents))}
        {row("Gross profit", hasSales ? `${formatMoney(c.grossProfitCents)} (${formatPercent(c.grossMarginPct)})` : "—", { strong: true })}
        {row("Labor", minus(c.laborCents))}
        {row("Operating expenses", minus(c.opexCents))}
        {row("Event fees", minus(c.feeCents))}
        {row(loss ? "Loss" : "Profit", formatMoney(c.profitCents, { signed: true }), { strong: true })}
        {row("Tips (staff, not in profit)", c.tipsCents ? formatMoney(c.tipsCents) : "—", { faint: true })}
      </dl>
    </>
  );
}

function PnlCard({ column: c, hero = false }: { column: PnlColumn; hero?: boolean }) {
  const loss = c.profitCents < 0;
  const hasSales = c.netSalesCents > 0;
  const sub = hero ? "text-highlight-foreground/80" : "text-muted-foreground";
  return (
    <article
      aria-label={c.key === "overall" ? "Overall profit and loss" : `${c.name} profit and loss`}
      className={cn("rounded-3xl px-4 pb-1 pt-3.5", hero ? "bg-highlight text-highlight-foreground" : "bg-card")}
    >
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("text-xs", sub)}>{hero ? "All events" : c.name} · {loss ? "loss" : "profit"}</p>
          <p className={cn("display-num text-[26px] font-medium leading-tight tracking-[-0.025em] tabular-nums", !hero && (loss ? "text-destructive" : "text-success"))}>
            <CountUp value={formatMoney(c.profitCents, { signed: true })} />
          </p>
        </div>
        {hasSales && (
          <span className={cn("mb-1 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums", hero ? "bg-highlight-foreground/10" : loss ? "bg-destructive-muted text-destructive" : "bg-success-muted text-success")}>
            {loss ? "▼ " : "▲ "}{formatPercent(c.marginPct)} margin
          </span>
        )}
      </div>
      <BreakdownToggle className="mt-1">
        <Breakdown c={c} hero={hero} />
      </BreakdownToggle>
    </article>
  );
}
