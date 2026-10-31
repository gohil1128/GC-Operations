import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatMoney, APP_LOCALE } from "@/lib/money";
import { fmtDate } from "@/lib/date";

/*
  The Overview's right rail: two small panels that answer "what sold" and
  "what do I owe" without leaving the page.
*/

// SalesItem.qty is a Float — items can be sold by weight — and summing floats
// leaves artefacts like 412.30000000000007. Whole counts stay whole; anything
// genuinely fractional keeps one decimal.
// Quantities, not money — but the same locale, so grouping and decimals
// match the figures beside them.
const qtyFormatter = new Intl.NumberFormat(APP_LOCALE, { maximumFractionDigits: 1 });
function formatQty(qty: number) {
  return qtyFormatter.format(qty);
}

export function TopItemsCard({
  items,
}: {
  items: { itemName: string; netSalesCents: number; qty: number }[];
}) {
  const top = items.slice(0, 5);
  const max = top[0]?.netSalesCents ?? 0;
  // Three tones cycling down the list: the flat brown reads as "most", and the
  // warmer steps keep the smaller bars from looking like errors.
  const tone = ["bg-espresso", "bg-espresso", "bg-amber", "bg-brand", "bg-amber"];

  return (
    <section className="panel p-[18px]">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Top items</h2>
        <span className="text-2xs text-muted-foreground">by revenue</span>
      </header>
      {top.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          No item-level sales in this range. Upload the Square per-item CSV to see the mix.
        </p>
      ) : (
        <ul className="mt-3.5 flex flex-col gap-2.5 text-xs">
          {top.map((it, i) => (
            <li key={it.itemName}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate" title={it.itemName}>
                  {it.itemName}
                </span>
                <b className="num shrink-0">{formatMoney(it.netSalesCents)}</b>
              </div>
              {/* Quantity rides on the bar's own line, so the card carries the
                  extra figure without growing a row taller. */}
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-beige">
                  <div
                    className={cn("h-full rounded-full", tone[i % tone.length])}
                    style={{ width: `${max > 0 ? Math.max(4, (it.netSalesCents / max) * 100) : 0}%` }}
                  />
                </div>
                <span className="num shrink-0 text-2xs text-muted-foreground">
                  {formatQty(it.qty)} sold
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export type DueInvoice = {
  id: string;
  invoiceNumber: string | null;
  invoiceDate: Date;
  totalCents: number;
  appliesToAllEvents: boolean;
  supplier: { name: string };
  event: { name: string } | null;
};

export function InvoicesDueCard({ invoices, now }: { invoices: DueInvoice[]; now: Date }) {
  return (
    <section className="panel p-[18px]">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Invoices due</h2>
        <Link
          href="/purchasing/invoices?status=open"
          className="relative inline-flex items-center text-2xs font-medium text-muted-foreground after:absolute after:-inset-x-3 after:-inset-y-3.5 after:content-[''] hover:text-foreground hover:underline"
        >
          View all
        </Link>
      </header>
      {invoices.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">Nothing open — every bill is closed.</p>
      ) : (
        <ul className="mt-2 flex flex-col text-xs">
          {invoices.map((inv, i) => {
            const days = Math.max(0, Math.round((now.getTime() - inv.invoiceDate.getTime()) / 86_400_000));
            return (
              <li
                key={inv.id}
                className={cn(
                  "flex items-center justify-between gap-3 py-2.5",
                  i < invoices.length - 1 && "border-b border-input",
                )}
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold">{inv.supplier.name}</div>
                  <div
                    className="truncate text-muted-foreground"
                    title={`${inv.invoiceNumber ?? "No number"} · ${
                      inv.appliesToAllEvents ? "Shared" : (inv.event?.name ?? "Untagged")
                    }`}
                  >
                    {inv.invoiceNumber ?? "No number"} ·{" "}
                    {inv.appliesToAllEvents ? "Shared" : (inv.event?.name ?? "Untagged")}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="num font-semibold">{formatMoney(inv.totalCents)}</div>
                  {/* The schema has no due date, so this is the bill's age, not
                      an invented deadline — and it says so. */}
                  <div className={cn("num", days >= 30 ? "text-destructive" : "text-muted-foreground")}>
                    {days === 0 ? "Today" : `Open ${days}d`} · {fmtDate(inv.invoiceDate, "MMM d")}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export type UpcomingEvent = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  feeCents: number;
  color: string | null;
};

/*
  Not in the ledger handoff, but this is the only place in the app that answers
  "what's next", and for an events business that belongs beside what's owed.
  Styled as a rail panel rather than the old bento card so it sits with its
  neighbours. The soonest event gets the espresso chip.
*/
export function UpcomingEventsCard({ events }: { events: UpcomingEvent[] }) {
  return (
    <section className="panel p-[18px]">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Upcoming events</h2>
        <Link
          href="/settings"
          className="relative inline-flex items-center text-2xs font-medium text-muted-foreground after:absolute after:-inset-x-3 after:-inset-y-3.5 after:content-[''] hover:text-foreground hover:underline"
        >
          Manage
        </Link>
      </header>
      {events.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Nothing scheduled. Add an event in Settings to track its P&amp;L.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {events.map((e, i) => (
            <li key={e.id}>
              <Link
                href={`/events/${e.id}`}
                className={cn(
                  "block rounded-lg px-3 py-2.5 transition-opacity hover:opacity-90",
                  i === 0 ? "bg-espresso text-espresso-foreground" : "bg-beige",
                )}
              >
              <div className="flex items-center gap-2 text-xs font-semibold">
                {i !== 0 && (
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-[2px]"
                    style={{ background: e.color ?? "hsl(var(--ink-400))" }}
                  />
                )}
                <span className="truncate" title={e.name}>
                  {e.name}
                </span>
              </div>
              <div className={cn("mt-0.5 text-2xs", i === 0 ? "opacity-75" : "text-muted-foreground")}>
                {fmtDate(e.startDate, "MMM d")}
                {e.endDate.getTime() !== e.startDate.getTime() && <> – {fmtDate(e.endDate, "MMM d")}</>}
                {e.feeCents > 0 && <> · fee {formatMoney(e.feeCents)}</>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
