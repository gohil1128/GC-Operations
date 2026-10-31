import { formatMoney, formatPercent } from "@/lib/money";
import { cn } from "@/lib/utils";

/*
  Revenue by event.

  Replaces the day-by-day line. For a business that trades a handful of days a
  season, a daily series is mostly a flat line at zero with occasional spikes —
  the gaps carried more pixels than the trading. One bar per event says the
  same thing in the shape the business actually has.

  Server-rendered: it is bars and numbers, and a chart that needs no pointer
  tracking should not ship a client bundle to draw itself.
*/

/*
  Profit, cost and margin are nullable because "Profit & loss" is lockable.
  When the owner locks that section, the page hands over bars with those three
  omitted rather than trusting this component to hide them — a figure that is
  never sent cannot be leaked by a styling mistake, a title attribute or
  View Source.
*/
export type EventBar = {
  id: string;
  name: string;
  color: string | null;
  netSalesCents: number;
  costCents: number | null;
  profitCents: number | null;
  marginPct: number | null;
};

export function EventRevenueChart({ bars }: { bars: EventBar[] }) {
  if (bars.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No events have recorded sales yet.
      </p>
    );
  }

  // Scaled against the biggest event, so the bars compare to each other rather
  // than to an arbitrary round number.
  const peak = Math.max(...bars.map((b) => b.netSalesCents), 1);

  return (
    <ul className="space-y-3.5">
      {bars.map((b) => {
        const salesPct = (b.netSalesCents / peak) * 100;
        const costPct =
          b.costCents !== null && b.netSalesCents > 0
            ? (b.costCents / b.netSalesCents) * salesPct
            : 0;
        return (
          <li key={b.id}>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                  style={{ background: b.color ?? "hsl(var(--ink-400))" }}
                />
                <span className="truncate font-medium" title={b.name}>
                  {b.name}
                </span>
              </span>
              <span className="num shrink-0 text-right">
                <span className="font-semibold">{formatMoney(b.netSalesCents)}</span>
                {b.profitCents !== null && (
                  <span
                    className={cn(
                      "ml-2 text-2xs",
                      b.profitCents < 0 ? "text-destructive" : "text-success",
                    )}
                  >
                    {formatMoney(b.profitCents, { signed: true })}
                    {b.marginPct !== null && <> · {formatPercent(b.marginPct)}</>}
                  </span>
                )}
              </span>
            </div>

            {/* Net sales as the full bar, with the cost it took to earn it
                shown inside — so the visible remainder is the profit. */}
            <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-beige">
              <div
                className="relative h-full rounded-full bg-chart-ink"
                style={{ width: `${Math.max(salesPct, 1.5)}%` }}
              >
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 rounded-l-full bg-brand/70"
                  style={{ width: `${Math.min(costPct * (100 / Math.max(salesPct, 1.5)), 100)}%` }}
                />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
