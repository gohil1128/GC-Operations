import Link from "next/link";
import { ArrowUpRight, Wallet, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/date";
import { formatMoney } from "@/lib/money";

/*
  The Overview's hero: the reference's top slab, carrying this business's
  numbers.

  One figure the eye lands on first, a line saying which way it moved, the
  last seven nights of trading as bars, and the two things somebody at the
  stall most often came here to do. Everything else on the page is detail
  under this.

  The bars are one series, not the reference's pairs. Its second bar is a
  comparison the daily data cannot honestly supply here — invoices are not
  dated to the night they were spent against — so rather than draw a cost bar
  from a guess, the most recent night is picked out in highlight instead, which
  is the question the chart is actually asked: "how did last night go".
*/

// $1.2k, $845, $12k: short enough to sit over a bar.
function compact(cents: number) {
  const d = cents / 100;
  if (d >= 10000) return `$${Math.round(d / 1000)}k`;
  if (d >= 1000) return `$${(d / 1000).toFixed(1)}k`;
  return `$${Math.round(d)}`;
}

export type TradingDay = { businessDate: Date; netSalesCents: number };

export function HeroCard({
  figure,
  figureLabel,
  delta,
  days,
  canCloseDrawer,
  canLogInvoice,
}: {
  figure: string;
  figureLabel: string;
  delta: { text: string; up: boolean } | null;
  days: TradingDay[];
  canCloseDrawer: boolean;
  canLogInvoice: boolean;
}) {
  const max = Math.max(1, ...days.map((d) => d.netSalesCents));
  const last = days.length - 1;
  const best = Math.max(0, ...days.map((d) => d.netSalesCents));
  const avg = days.length ? Math.round(days.reduce((a, d) => a + d.netSalesCents, 0) / days.length) : 0;

  return (
    <section className="rounded-[28px] bg-card p-5 sm:p-6" aria-label="Sales at a glance">
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-highlight text-highlight-foreground">
          <Wallet className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] text-muted-foreground">{figureLabel}</div>
          <div className="display-num mt-0.5 truncate text-[34px] font-medium leading-tight tracking-[-0.025em] tabular-nums sm:text-[40px]">
            {figure}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {delta ? (
              <>
                <span className={delta.up ? "text-success" : "text-destructive"}>
                  {delta.up ? "▲" : "▼"} {delta.text}
                </span>{" "}
                vs the previous period
              </>
            ) : (
              "No earlier period to compare"
            )}
          </div>
        </div>
        <Link
          href="/reports"
          aria-label="Open the full profit and loss report"
          className="lg-press grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border text-foreground hover:bg-foreground/[0.06]"
        >
          <ArrowUpRight className="h-[18px] w-[18px]" aria-hidden />
        </Link>
      </div>

      {days.length > 0 ? (
        <figure className="mt-6">
          {/* The bars are a picture of the list below, which is what a screen
              reader gets instead. */}
          <div aria-hidden className="relative">
            {/* The average, as a dashed line across every column. */}
            <div
              className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-foreground/25"
              style={{ bottom: `${(avg / max) * 146}px` }}
            />
            <div className="flex h-[168px] items-end justify-between gap-2 sm:gap-3">
              {days.map((d, i) => (
                <div key={d.businessDate.toISOString()} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                  <span className={cn("num mb-1 text-[10.5px] font-semibold leading-none tabular-nums", i === last ? "text-foreground" : "text-muted-foreground")}>
                    {compact(d.netSalesCents)}
                  </span>
                  {/* A faint track behind each bar gives the chart body even on a quiet night. */}
                  <div className="relative flex h-[146px] w-full max-w-[30px] items-end overflow-hidden rounded-full bg-muted/70">
                    {/* Flat fills, no entrance: the bars are simply there with the page. */}
                    <div
                      className={cn(
                        "w-full rounded-full",
                        i === last ? "bg-highlight" : d.netSalesCents === best ? "bg-foreground/75" : "bg-foreground/50",
                      )}
                      // Never fully flat: a night that took money should not draw
                      // as the same nothing as a night that did not happen.
                      style={{ height: `${Math.max(4, (d.netSalesCents / max) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div aria-hidden className="mt-2 flex justify-between gap-2 border-t border-dashed border-border pt-2 sm:gap-3">
            {days.map((d, i) => (
              <span
                key={d.businessDate.toISOString()}
                className={cn(
                  "min-w-0 flex-1 text-center text-[11px]",
                  i === last ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                <span className="block leading-tight">{fmtDate(d.businessDate, "EEE")}</span>
                <span className="block leading-tight">{fmtDate(d.businessDate, "d")}</span>
              </span>
            ))}
          </div>
          <p aria-hidden className="mt-2 flex items-center justify-center gap-2 text-[10.5px] text-muted-foreground">
            <span className="w-5 border-t border-dashed border-foreground/40" /> {days.length}-day average {compact(avg)}
          </p>
          <figcaption className="sr-only">
            Net sales on the last {days.length} trading days:{" "}
            {days.map((d) => `${fmtDate(d.businessDate, "EEEE MMM d")} ${formatMoney(d.netSalesCents)}`).join("; ")}.
          </figcaption>
        </figure>
      ) : (
        <p className="mt-6 rounded-2xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
          No trading days yet. Once a night&apos;s sales are in, the last seven appear here.
        </p>
      )}

      {(canCloseDrawer || canLogInvoice) && (
        <div className="mt-6 grid grid-cols-2 gap-3">
          {canCloseDrawer && (
            <Link
              href="/cash/new"
              className={cn(
                "lg-press inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-highlight px-3 text-[15px] font-semibold text-highlight-foreground",
                !canLogInvoice && "col-span-2",
              )}
            >
              <Wallet className="h-[18px] w-[18px] shrink-0" aria-hidden />
              Close drawer
            </Link>
          )}
          {canLogInvoice && (
            <Link
              href="/purchasing/invoices/new"
              className={cn(
                "lg-press inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-foreground px-3 text-[15px] font-semibold text-background",
                !canCloseDrawer && "col-span-2",
              )}
            >
              <FileText className="h-[18px] w-[18px] shrink-0" aria-hidden />
              Log invoice
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
