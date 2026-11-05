import Link from "next/link";
import { ArrowUpRight, Wallet, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import { CountUp } from "@/components/count-up";

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

  return (
    <section className="rounded-[28px] bg-card p-5 sm:p-6" aria-label="Sales at a glance">
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-highlight text-highlight-foreground">
          <Wallet className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] text-muted-foreground">{figureLabel}</div>
          <div className="display-num mt-0.5 truncate text-[34px] font-medium leading-tight tracking-[-0.025em] tabular-nums sm:text-[40px]">
            <CountUp value={figure} />
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
          <div aria-hidden className="flex h-36 items-end justify-between gap-2 sm:gap-3">
            {days.map((d, i) => (
              <div key={d.businessDate.toISOString()} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                <div
                  className={cn(
                    "bar-grow w-full max-w-[28px] rounded-full",
                    i === last ? "bg-highlight" : "bg-foreground/85",
                  )}
                  // Never fully flat: a night that took money should not draw
                  // as the same nothing as a night that did not happen.
                  // Staggered 30ms left to right, oldest night first.
                  style={{
                    height: `${Math.max(6, (d.netSalesCents / max) * 100)}%`,
                    animationDelay: `${120 + i * 30}ms`,
                  }}
                />
              </div>
            ))}
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
