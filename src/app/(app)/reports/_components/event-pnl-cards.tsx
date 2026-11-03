import { cn } from "@/lib/utils";
import { formatMoney, formatPercent } from "@/lib/money";
import type { PnlColumn } from "@/modules/reports/queries";
import { BreakdownToggle } from "./breakdown-toggle";
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
      {active.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {active.map((c) => (
            <li key={c.key} className="min-w-0">
              <PnlCard column={c} />
            </li>
          ))}
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

function PnlCard({ column: c, hero = false }: { column: PnlColumn; hero?: boolean }) {
  const costs = costsOf(c);
  const loss = c.profitCents < 0;
  const hasSales = c.netSalesCents > 0;
  // Of every sales dollar: how much went to costs, and how much was kept.
  const spentPct = hasSales ? Math.min(100, Math.max(0, (costs / c.netSalesCents) * 100)) : 0;

  /*
    The hero card is lime, so nothing inside it can use the usual red/green for
    profit and loss — red on lime fails contrast and green on lime is invisible.
    It says the same thing in ink, with the sign and the word, which is also
    what a colour-blind reader needs everywhere else.
  */
  const sub = hero ? "text-highlight-foreground/80" : "text-muted-foreground";
  const line = hero ? "border-highlight-foreground/15" : "border-border-soft";

  const row = (label: string, value: React.ReactNode, opts: { strong?: boolean; faint?: boolean } = {}) => (
    <div className={cn("flex items-baseline justify-between gap-4 border-b py-2.5 text-sm last:border-b-0", line)}>
      <dt className={cn(opts.faint ? "text-xs" : "", opts.strong ? "font-semibold" : sub)}>{label}</dt>
      <dd className={cn("num text-right tabular-nums", opts.strong && "font-semibold", opts.faint && cn("text-xs", sub))}>{value}</dd>
    </div>
  );
  const minus = (cents: number) => (cents ? <>−{formatMoney(cents)}</> : "—");

  return (
    <article
      aria-label={c.key === "overall" ? "Overall profit and loss" : `${c.name} profit and loss`}
      className={cn("rounded-3xl p-4 sm:p-5", hero ? "bg-highlight text-highlight-foreground" : "bg-card")}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {!hero && (
            <span
              aria-hidden
              className="h-3 w-3 shrink-0 rounded-full ring-1 ring-inset ring-foreground/25"
              style={{ backgroundColor: c.color ?? "hsl(var(--muted-foreground))" }}
            />
          )}
          <h3 className={cn("min-w-0 truncate font-display font-semibold tracking-[-0.01em]", hero ? "text-xl" : "text-base")} title={c.name}>
            {hero ? "All events together" : c.name}
          </h3>
        </div>
        {hasSales && (
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums",
              hero ? "bg-highlight-foreground/10" : loss ? "bg-destructive-muted text-destructive" : "bg-success-muted text-success",
            )}
          >
            {loss ? "▼ " : "▲ "}
            {formatPercent(c.marginPct)} margin
          </span>
        )}
      </header>

      <p className={cn("mt-4 text-xs", sub)}>{loss ? "Loss" : "Profit"}</p>
      <p
        className={cn(
          "display-num -mt-0.5 text-[32px] font-medium leading-tight tracking-[-0.025em] tabular-nums",
          !hero && (loss ? "text-destructive" : "text-success"),
        )}
      >
        <CountUp value={formatMoney(c.profitCents, { signed: true })} />
      </p>

      {hasSales && (
        <div className="mt-3">
          {/* Purely a picture of the two figures printed under it. */}
          <div aria-hidden className={cn("flex h-2 overflow-hidden rounded-full", hero ? "bg-highlight-foreground/15" : "bg-muted")}>
            <div
              className={cn(hero ? "bg-highlight-foreground/35" : loss ? "bg-destructive" : "bg-foreground/25")}
              style={{ width: `${spentPct}%` }}
            />
            {!loss && <div className={cn("flex-1", hero ? "bg-highlight-foreground" : "bg-brand-ink")} />}
          </div>
          <p className={cn("mt-2 flex justify-between gap-3 text-xs tabular-nums", sub)}>
            <span>Sales {formatMoney(c.netSalesCents)}</span>
            <span>Costs {formatMoney(costs)}</span>
          </p>
        </div>
      )}

      <BreakdownToggle className="mt-2">
        <dl className="pb-1">
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
      </BreakdownToggle>
    </article>
  );
}
