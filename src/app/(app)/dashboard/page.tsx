import Link from "next/link";
import { Download, Lock } from "lucide-react";
import { requireCapability } from "@/lib/scope";
import { prisma } from "@/lib/prisma";
import { getDashboard, getPriorNetSales } from "@/modules/dashboard/queries";
import { getTopItems } from "@/modules/dashboard/items";
import { resolveEventScope, listEventOptions } from "@/modules/dashboard/event-scope";
import { getActiveEvent, listUpcomingEvents } from "@/modules/events/queries";
import { getInvoiceTracking, listOpenInvoicesDue } from "@/modules/invoices/queries";
import { pnlByEvent } from "@/modules/reports/queries";
import { isSectionLocked } from "@/modules/section-lock/actions";
import { fmtDate } from "@/lib/date";
import { formatMoney, formatMoneyHeadline, formatPercent, safeDivide } from "@/lib/money";
import { KpiStrip, type Kpi } from "@/components/dashboard/ledger/kpi-strip";
import { EventControl } from "@/components/dashboard/event-control";
import { TimezoneNotice } from "@/components/dashboard/timezone-notice";
import { PnlStatement } from "@/components/dashboard/ledger/pnl-statement";
import {
  TopItemsCard,
  InvoicesDueCard,
  UpcomingEventsCard,
} from "@/components/dashboard/ledger/rail-cards";
import { EventRevenueChart } from "@/components/dashboard/event-revenue-chart";
import { ItemMixDonut } from "@/components/dashboard/bento/item-mix-donut";
import { isCardVisible, type OverviewCardKey } from "@/modules/dashboard/cards";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/*
  Overview — the "ledger" layout.

  Statement first: one ruled KPI band, then the per-event P&L as the hero, with
  a narrow rail for what sold and what's owed. Everything on the page reads
  from one resolved scope, so the event control moves all of it at once.

  Scoped by event rather than by date. This business does not trade daily — it
  trades at events, with weeks of nothing between them — so a date range asked
  a question nobody here has, and could hide an event that fell a day outside
  the window.
*/

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, scope] = await Promise.all([searchParams, requireCapability("overview")]);
  const [activeEvent, business] = await Promise.all([
    getActiveEvent(scope.businessId),
    prisma.business.findUnique({
      where: { id: scope.businessId },
      select: { timezone: true, hiddenOverviewCards: true },
    }),
  ]);
  const [range, eventOptions] = await Promise.all([
    resolveEventScope(scope.businessId, params, activeEvent),
    listEventOptions(scope.businessId),
  ]);
  const canChangeSettings = can(scope.role, "settings");
  const now = new Date();
  /*
    Which cards this business wants. Stored as the hidden ones, so a card added
    to the registry later shows up for everybody rather than staying invisible
    until each business enables it.
  */
  const show = (key: OverviewCardKey) => isCardVisible(business?.hiddenOverviewCards, key);
  // How many of the three rail cards survive, so the statement can take the
  // full width when the whole rail is switched off.
  const railCards = (["topItems", "invoicesDue", "upcomingEvents"] as const).filter(show).length;
  // Locking "Profit & loss" has to cover the Overview too. The statement and
  // the profit figures live here as well, so gating only /reports would hide
  // the page while leaving the same margins on the landing screen.
  const pnlLocked = await isSectionLocked(scope.businessId, "REPORTS");

  const [data, pnl, invoiceTracking, dueInvoices, priorNetSales, upcoming] = await Promise.all([
    getDashboard({
      businessId: scope.businessId,
      locationId: scope.locationId,
      eventId: range.eventId,
      eventRange: { start: range.start, end: range.end },
      timezone: business?.timezone ?? "UTC",
    }),
    pnlByEvent(scope.businessId, scope.locationId, { start: range.start, end: range.end }),
    getInvoiceTracking(scope.locationId),
    listOpenInvoicesDue(scope.locationId, 3),
    getPriorNetSales(scope.locationId, { start: range.start, end: range.end }),
    listUpcomingEvents(scope.businessId, now, 3),
  ]);

  const topItems = await getTopItems({
    locationId: scope.locationId,
    from: range.start,
    to: range.end,
    eventId: range.eventId,
    limit: 12,
  });

  const overall = pnl.find((c) => c.key === "overall");
  // When one event scopes the page, the headline figures have to come from
  // that event's column, not from Overall. Overall covers everything inside
  // the window — including other events running the same days — while the
  // top-items list is filtered to the event, so reading both from Overall
  // would put a net-sales figure next to an item list that doesn't add up
  // to it. The statement keeps showing the whole window: comparing against
  // what else ran those days is the point of it.
  const focus = (range.eventId ? pnl.find((c) => c.key === range.eventId) : null) ?? overall;
  const netSalesCents = focus?.netSalesCents ?? 0;
  const profitCents = focus?.profitCents ?? 0;
  const txns = focus?.txns ?? 0;

  const deltaPct = priorNetSales ? ((netSalesCents - priorNetSales) / priorNetSales) * 100 : null;
  const avgTicketCents = txns > 0 ? Math.round(safeDivide(netSalesCents, txns)) : 0;

  const kpis: Kpi[] = [
    {
      label: "Net sales",
      value: formatMoneyHeadline(netSalesCents),
      tone: deltaPct === null ? "muted" : deltaPct >= 0 ? "success" : "danger",
      // "vs last season" isn't derivable — there is no season concept — so the
      // comparison is the preceding window of equal length, and says so.
      sub:
        deltaPct === null
          ? "No earlier period to compare"
          : `${deltaPct >= 0 ? "▲" : "▼"} ${formatPercent(Math.abs(deltaPct))} vs previous period`,
    },
    {
      label: "Profit",
      value: pnlLocked ? "•••" : formatMoneyHeadline(profitCents, { signed: true }),
      sub: pnlLocked
        ? "Locked"
        : netSalesCents > 0
          ? `${formatPercent(focus?.marginPct ?? 0)} margin`
          : "No sales in range",
    },
    {
      label: "Open invoices",
      value: formatMoneyHeadline(invoiceTracking.openBalanceCents),
      tone: invoiceTracking.openCount > 0 ? "brand" : "muted",
      sub:
        invoiceTracking.openCount === 0
          ? "Every bill closed"
          : `${invoiceTracking.openCount} open · oldest ${
              invoiceTracking.oldestOpen ? fmtDate(invoiceTracking.oldestOpen.date, "MMM d") : "—"
            }`,
    },
    {
      label: "Avg. ticket",
      value: avgTicketCents > 0 ? formatMoney(avgTicketCents) : "—",
      sub: `${topItems.totalQty.toLocaleString()} items · ${txns.toLocaleString()} tickets`,
    },
  ];

  /*
    Revenue by event, not by day. The P&L already has a column per event, so
    the bars read straight off it rather than being recomputed — the chart and
    the statement under it cannot disagree. "Overall" is the statement's total
    column, not an event, so it is dropped.
  */
  const eventBars = pnl
    .filter((c) => c.key !== "overall" && c.netSalesCents > 0)
    .map((c) => ({
      id: c.key,
      name: c.name,
      color: c.color,
      netSalesCents: c.netSalesCents,
      /*
        Cost, profit and margin are withheld when "Profit & loss" is locked.

        The statement above shows a padlock and the Profit KPI reads "•••" when
        locked, but this chart printed exact per-event profit and margin right
        underneath them — so the lock hid the two places that say "locked" and
        left the numbers themselves on screen. Net sales stays visible, matching
        the Net sales KPI, which is deliberately not masked.

        Withheld here rather than hidden in the component: a figure that never
        reaches the client cannot be read out of the HTML.
      */
      costCents: pnlLocked ? null : c.cogsCents + c.laborCents + c.opexCents + c.feeCents,
      profitCents: pnlLocked ? null : c.profitCents,
      marginPct: pnlLocked ? null : c.marginPct,
    }))
    .sort((a, b) => b.netSalesCents - a.netSalesCents);

  return (
    <div className="pb-12">
      {/*
        The Overview has no PageHeader of its own, so it carries the same
        photograph masthead explicitly — marked the same way, so the contrast
        sweep knows the type over it is meant to be light.

        IT NOW CARRIES THE SAME TYPE SCALE TOO. Every other page in the app
        gets an eyebrow over a 40px display title here; the Overview — the
        page people actually land on — had a single line of 13px grey, which
        made the home screen's own title the smallest text on it and smaller
        than the card headings underneath. The shape below is PageHeader's,
        class for class, so the two cannot drift apart.

        PageHeader is not used directly because it wraps its actions in a
        glass pill, and EventControl is already one. Glass inside glass has
        nothing left to refract — the same rule that took the frost off the
        content cards.
      */}
      <div className="relative" data-on-photo>
        <div className="app-photo" aria-hidden />
        <div className="relative mx-auto flex max-w-[1400px] flex-col gap-3 px-4 pb-5 pt-5 sm:flex-row sm:items-end sm:justify-between sm:gap-4 sm:px-6 sm:pt-6 lg:px-8">
          <div>
            <div className="text-xs text-white/80">Overview</div>
            <h1 className="display-num mt-1 text-[26px] font-medium text-white sm:text-[40px] sm:font-normal sm:tracking-[-0.025em]">
              {range.label}
            </h1>
            <p className="mt-1.5 text-sm text-white/85">{range.subLabel}</p>
          </div>
          <EventControl
            events={eventOptions}
            activeKey={range.key}
            activeLabel={range.label}
            basePath="/dashboard"
          />
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
      {/* Above the figures, not in Settings: a business on the wrong timezone
          has no symptom to go looking for, so the only place the warning can
          do any good is in front of the numbers it is quietly bending. Only
          shown to somebody who could act on it. */}
      {canChangeSettings && business?.timezone && (
        <div className="mt-5">
          <TimezoneNotice businessTimezone={business.timezone} />
        </div>
      )}
      {show("kpis") && <KpiStrip items={kpis} />}

      {/* Statement + rail. The grid collapses to one column when a business has
          turned off everything on one side, so a hidden card leaves no gap. */}
      {(show("pnl") || railCards > 0) && (
      <div className={cn("mt-7 grid gap-5", show("pnl") && railCards > 0 && "lg:grid-cols-[minmax(0,1fr)_300px]")}>
        {show("pnl") && (
        <section className="min-w-0">
          <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 className="font-display text-xl font-semibold">Profit &amp; loss statement</h2>
            {/* Not rendered rather than CSS-hidden: a locked page should not
                carry a live link to its own export, even an invisible one. */}
            {!pnlLocked && (
            <div className="flex shrink-0 items-center gap-5">
              {/* The statement's column headings already open an event, but
                  that isn't discoverable — this names the destination. */}
              <Link
                href="/events"
                className="relative inline-flex items-center gap-1 text-xs font-medium text-muted-foreground after:absolute after:-inset-x-2 after:-inset-y-3.5 after:content-[''] hover:text-foreground hover:underline"
              >
                Browse events
              </Link>
              <a
                href="/api/exports/pnl"
                className="relative inline-flex items-center gap-1 text-xs font-medium text-muted-foreground after:absolute after:-inset-x-2 after:-inset-y-3.5 after:content-[''] hover:text-foreground hover:underline"
              >
                Export CSV
                <Download className="h-3 w-3" aria-hidden />
              </a>
            </div>
            )}
          </header>
          <div className="mt-3.5">
            {pnlLocked ? (
              <div className="panel flex flex-col items-center gap-3 p-8 text-center">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-muted">
                  <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
                </span>
                <p className="text-sm text-muted-foreground">
                  Profit &amp; loss is locked. Enter the PIN to see the statement.
                </p>
                <Link
                  href="/reports"
                  className="rounded-full bg-espresso px-4 py-2 text-[13px] font-medium text-espresso-foreground"
                >
                  Unlock
                </Link>
              </div>
            ) : pnl.length > 1 ? (
              <PnlStatement columns={pnl} />
            ) : (
              <p className="panel p-6 text-sm text-muted-foreground">
                Nothing recorded against {range.label} yet. Tag sales and invoices to an event to
                start splitting them by where they happened.
              </p>
            )}
          </div>
        </section>
        )}

        {railCards > 0 && (
        <div className="flex min-w-0 flex-col gap-5">
          {show("topItems") && <TopItemsCard items={topItems.items} />}
          {show("invoicesDue") && <InvoicesDueCard invoices={dueInvoices} now={now} />}
          {show("upcomingEvents") && <UpcomingEventsCard events={upcoming} />}
        </div>
        )}
      </div>
      )}

      {/* Per-event and category views, below the statement. */}
      {(show("revenueByEvent") || show("itemMix")) && (
      <div className={cn("mt-5 grid gap-5 [&>*]:min-w-0", show("revenueByEvent") && show("itemMix") && "lg:grid-cols-[minmax(0,1fr)_300px]")}>
        {show("revenueByEvent") && (
        <div className="bento min-w-0 p-4 sm:p-[22px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-5">
              <h2 className="text-base font-semibold">Revenue · by event</h2>
              <span className="flex gap-3.5 text-xs text-muted-foreground">
                <span>● Net sales</span>
                <span className="text-brand-ink">● What it cost</span>
              </span>
            </div>
            {/* Was a 28px circle holding an arrow: under the 44px minimum, and
                an arrow in a ring names no destination. */}
            <Link href="/reports" className="relative inline-flex items-center text-xs font-medium text-muted-foreground after:absolute after:-inset-x-2 after:-inset-y-3.5 after:content-[''] hover:text-foreground hover:underline">
              Full report
            </Link>
          </div>
          <EventRevenueChart bars={eventBars} />
        </div>
        )}

        {show("itemMix") && (
        <div className="bento min-w-0 p-4 sm:p-[22px]">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Item mix</h2>
            {/* Points at /sales, which is the item-level page. Its label already
                said "Item sales" while the href went to /reports — the label
                named one destination and the link went to another. Same
                `financials` capability, so nobody gains or loses access. */}
            <Link href="/sales" className="relative inline-flex items-center text-xs font-medium text-muted-foreground after:absolute after:-inset-x-2 after:-inset-y-3.5 after:content-[''] hover:text-foreground hover:underline">
              All items
            </Link>
          </div>
          {topItems.byCategory.length > 0 ? (
            <ItemMixDonut slices={topItems.byCategory} totalQty={topItems.totalQty} />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {topItems.count === 0
                ? "No item-level sales yet. Upload the Square per-item CSV to see the mix."
                : `No item sales between ${fmtDate(range.start)} and ${fmtDate(range.end)}.`}
            </p>
          )}
        </div>
        )}
      </div>
      )}
      </div>
    </div>
  );
}
