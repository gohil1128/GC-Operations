import Link from "next/link";
import { Download, Lock, ShoppingBag, TrendingUp, FileText, Receipt, AlertTriangle } from "lucide-react";
import { auth } from "@/lib/auth";
import { requireCapability } from "@/lib/scope";
import { prisma } from "@/lib/prisma";
import { getDashboard, getPriorNetSales, recentTradingDays } from "@/modules/dashboard/queries";
import { getTopItems } from "@/modules/dashboard/items";
import { resolveEventScope, listEventOptions } from "@/modules/dashboard/event-scope";
import { getActiveEvent, listUpcomingEvents } from "@/modules/events/queries";
import { getInvoiceTracking, listOpenInvoicesDue } from "@/modules/invoices/queries";
import { findUncountedDrawers } from "@/modules/cash/queries";
import { pnlByEvent } from "@/modules/reports/queries";
import { isSectionLocked } from "@/modules/section-lock/actions";
import { PnlLock } from "@/components/pnl-lock";
import { fmtDate } from "@/lib/date";
import { formatMoney, formatMoneyHeadline, formatPercent, safeDivide } from "@/lib/money";
import { KpiStrip, type Kpi } from "@/components/dashboard/ledger/kpi-strip";
import { EventControl } from "@/components/dashboard/event-control";
import { Dismissible } from "@/components/dismissible";
import { TimezoneNotice } from "@/components/dashboard/timezone-notice";
import { PnlStatement } from "@/components/dashboard/ledger/pnl-statement";
import {
  TopItemsCard,
  InvoicesDueCard,
  UpcomingEventsCard,
} from "@/components/dashboard/ledger/rail-cards";
import { HeroCard } from "@/components/dashboard/hero-card";
import { EventCards, type EventCard } from "@/components/dashboard/event-cards";
import { PremixCard } from "@/components/dashboard/premix-card";
import { getPremixSummary } from "@/modules/sales/premix";
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
  const [params, scope, session] = await Promise.all([
    searchParams,
    requireCapability("overview"),
    auth(),
  ]);
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
  const railCards = (["topItems", "invoicesDue", "upcomingEvents", "itemMix"] as const).filter(show).length;
  // Locking "Profit & loss" has to cover the Overview too. The statement and
  // the profit figures live here as well, so gating only /reports would hide
  // the page while leaving the same margins on the landing screen.
  const pnlLocked = await isSectionLocked(scope.userId, "REPORTS");
  // Premix ignores the event picker on purpose: it is every bag, everywhere.
  const premix = isCardVisible(business?.hiddenOverviewCards, "premix") ? await getPremixSummary(scope.locationId) : null;

  const [data, pnl, invoiceTracking, dueInvoices, priorNetSales, upcoming, uncounted] =
    await Promise.all([
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
    findUncountedDrawers(scope.locationId),
  ]);
  const tradingDays = await recentTradingDays(scope.locationId, range.eventId);

  const topItems = await getTopItems({
    locationId: scope.locationId,
    from: range.start,
    to: range.end,
    eventId: range.eventId,
    limit: 12,
  });

  /*
    The greeting, in the BUSINESS's timezone rather than the server's.

    The container runs in UTC. Reading the hour off `new Date()` would have
    told a Toronto owner "Good morning" at nine in the evening — which is the
    same class of bug the timezone notice below exists to warn about, so
    putting it in the greeting would have been poor form.
  */
  const tz = business?.timezone ?? "UTC";
  const localHour = Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, hour: "numeric", hour12: false }).format(now),
  );
  const partOfDay = localHour < 12 ? "morning" : localHour < 17 ? "afternoon" : "evening";
  const firstName = (session?.user?.name ?? "").trim().split(/\s+/)[0] || "there";

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
      icon: ShoppingBag,
      // "vs last season" isn't derivable — there is no season concept — so the
      // comparison is the preceding window of equal length, and says so.
      delta:
        deltaPct === null
          ? null
          : { text: formatPercent(Math.abs(deltaPct)), tone: deltaPct >= 0 ? "up" : "down" },
      sub: deltaPct === null ? "No earlier period to compare" : "vs previous period",
    },
    {
      label: "Profit",
      value: pnlLocked ? "•••" : formatMoneyHeadline(profitCents, { signed: true }),
      icon: TrendingUp,
      // The margin rides in the chip rather than the sub-line, which is what
      // makes the tile readable at a glance — but never when the section is
      // locked, because a margin is exactly what the lock exists to hide.
      delta:
        pnlLocked || netSalesCents === 0
          ? null
          : { text: formatPercent(focus?.marginPct ?? 0), tone: profitCents >= 0 ? "up" : "down" },
      sub: pnlLocked ? "Locked" : netSalesCents > 0 ? "margin on net sales" : "No sales in range",
    },
    {
      label: "Open invoices",
      value: formatMoneyHeadline(invoiceTracking.openBalanceCents),
      icon: FileText,
      // Rust, not red: bills piling up is a queue, not a fault.
      delta:
        invoiceTracking.openCount === 0
          ? null
          : { text: `${invoiceTracking.openCount} open`, tone: "alert" },
      sub:
        invoiceTracking.openCount === 0
          ? "Every bill closed"
          : `oldest ${invoiceTracking.oldestOpen ? fmtDate(invoiceTracking.oldestOpen.date, "MMM d") : "—"}`,
    },
    {
      label: "Avg. ticket",
      value: avgTicketCents > 0 ? formatMoney(avgTicketCents) : "—",
      icon: Receipt,
      delta: null,
      sub: `${topItems.totalQty.toLocaleString()} items · ${txns.toLocaleString()} tickets`,
    },
  ];

  // Same columns as the statement, so a card and its column cannot disagree.
  const eventCards: EventCard[] = pnl
    .filter((c) => c.key !== "overall" && c.netSalesCents > 0)
    .sort((a, b) => b.netSalesCents - a.netSalesCents)
    .slice(0, 4)
    .map((c) => ({
      id: c.key,
      name: c.name,
      color: c.color,
      netSalesCents: c.netSalesCents,
      marginPct: pnlLocked ? null : c.marginPct,
    }));
  const highlightId = range.eventId ?? eventCards[0]?.id ?? null;

  return (
    <div className="arrive mx-auto max-w-[1400px] px-4 pb-12 pt-5 sm:px-6 lg:px-8">
      {/*
        The v3 page header: a greeting over a line of context, with the event
        control on the right and a rule under the lot.

        The photograph masthead is gone. It was a 120px band of scrim-darkened
        image above every figure on the page, and v3 puts the content first on
        a plain page instead — which on the tablet this is read on at a stall
        is most of a screen of numbers recovered.
      */}
      <header className="flex flex-col gap-4 pb-2 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
        <div className="min-w-0">
          <h1 className="font-display text-[26px] font-semibold tracking-[-0.02em]">
            Good {partOfDay}, {firstName}
          </h1>
          <p className="mt-[3px] text-[13px] text-muted-foreground">
            Here&apos;s where things stand · {range.subLabel}
          </p>
        </div>
        <EventControl
          events={eventOptions}
          activeKey={range.key}
          activeLabel={range.label}
          basePath="/dashboard"
        />
      </header>

      {/* Above the figures, not in Settings: a business on the wrong timezone
          has no symptom to go looking for, so the only place the warning can
          do any good is in front of the numbers it is quietly bending. Only
          shown to somebody who could act on it. */}
      {canChangeSettings && business?.timezone && (
        <div className="mt-5">
          <TimezoneNotice businessTimezone={business.timezone} />
        </div>
      )}
      {/*
        A day took money and nobody counted the drawer.

        New in v3, and real rather than illustrative: it comes from a day that
        has DailySales but no matching CashClose, which is the same check the
        sidebar's rust dot uses. Only shown to somebody who can actually close
        a drawer — for everyone else it would be a permanent red mark against
        a job they are not allowed to do.
      */}
      {uncounted.count > 0 && can(scope.role, "cash") && (
        <Dismissible
          id={`cash-close:${uncounted.latest ? uncounted.latest.toISOString().slice(0, 10) : "x"}:${uncounted.count}`}
          label="Dismiss this notice"
          className="gap-3 rounded-[14px] border border-warning-border bg-warning-muted px-3.5 py-[11px] text-[12.5px] text-warning-ink"
        >
          <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-amber text-amber-foreground">
            <AlertTriangle className="h-3 w-3" aria-hidden />
          </span>
          <span className="min-w-0">
            <b className="font-semibold">
              {uncounted.latest
                ? `${fmtDate(uncounted.latest, "MMM d")} has no cash close`
                : "A day has no cash close"}
            </b>{" "}
            {/* The explanation is for screens with room for it. On a phone the
                line above and the action beside it are the whole message, and
                the sentence was wrapping the banner to four lines. */}
            <span className="hidden sm:inline">
              {uncounted.count > 1 &&
                `and ${uncounted.count - 1} other ${uncounted.count === 2 ? "day" : "days"} too. `}
              The drawer was never counted, so the cash figures for it are expected, not counted.
            </span>
          </span>
          <Link
            href="/cash/new"
            className="ml-auto shrink-0 whitespace-nowrap font-semibold text-alert hover:underline relative after:absolute after:-inset-x-2 after:-inset-y-3.5 after:content-['']"
          >
            Close drawer →
          </Link>
        </Dismissible>
      )}

      {/*
        The hero and the stats beside it. Net sales leads as the hero figure,
        so the stat column carries the other three and does not repeat it.
      */}
      <div className={cn("mt-5 grid gap-4", show("kpis") && "lg:grid-cols-[minmax(0,1fr)_300px]")}>
        <HeroCard
          figure={formatMoneyHeadline(netSalesCents)}
          figureLabel={`Net sales · ${range.label}`}
          delta={deltaPct === null ? null : { text: formatPercent(Math.abs(deltaPct)), up: deltaPct >= 0 }}
          days={tradingDays}
          canCloseDrawer={can(scope.role, "cash")}
          canLogInvoice={can(scope.role, "purchasing")}
        />
        {show("kpis") && (
          <KpiStrip items={kpis.slice(1)} className="mt-0 grid-cols-3 gap-2.5 sm:gap-3 lg:grid-cols-1" />
        )}
      </div>

      {show("premix") && premix && (
        <div className="mt-4">
          <PremixCard data={premix} />
        </div>
      )}

      {show("revenueByEvent") && (
        <div className="mt-8">
          <EventCards events={eventCards} highlightId={highlightId} />
        </div>
      )}

      {/* Statement + rail. The grid collapses to one column when a business has
          turned off everything on one side, so a hidden card leaves no gap. */}
      {(show("pnl") || railCards > 0) && (
      <div className={cn("mt-7 grid gap-5", show("pnl") && railCards > 0 && "lg:grid-cols-[minmax(0,1fr)_300px]")}>
        {show("pnl") && (
        <section className="min-w-0">
          <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 className="flex items-center gap-1.5 font-display text-xl font-semibold">
              Profit &amp; loss statement
              {/* The tiny lock: add a personal PIN here, or re-lock. Not shown while locked. */}
              {!pnlLocked && <PnlLock userId={scope.userId} />}
            </h2>
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
                  Profit &amp; loss is locked with your PIN. Enter it to see the statement.
                </p>
                <Link
                  href="/reports"
                  className="rounded-full bg-highlight px-4 py-2 text-[13px] font-medium text-highlight-foreground"
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
        {show("itemMix") && (
        <div className="panel min-w-0 p-[18px]">
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
      )}

    </div>
  );
}
