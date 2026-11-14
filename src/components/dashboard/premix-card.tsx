"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Check, ChevronDown, Package, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney, formatPercent } from "@/lib/money";
import { fmtBusinessDate } from "@/lib/date";
import { EventMark } from "@/components/event-mark";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { PremixData } from "@/modules/sales/premix";
import { filterPremixRows, summarisePremix } from "@/modules/sales/premix-summary";

const qty = (n: number) => (Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1));

/*
  Premix on Home: every bag sold, across all events, whatever event the page
  is set to — and two filters of its own, by event and by the date sold, so a
  single market or a stretch of days can be read on its own. The filters work
  on the rows already here, so changing them is instant and leaves the rest of
  Home alone.
*/
type DateKey = "all" | "7" | "30" | "month" | "custom";
const DATE_LABEL: Record<DateKey, string> = { all: "All time", "7": "Last 7 days", "30": "Last 30 days", month: "This month", custom: "Custom dates" };

function shiftIso(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function PremixCard({ data, todayIso }: { data: PremixData; todayIso: string }) {
  const [eventId, setEventId] = useState("all");
  const [dateKey, setDateKey] = useState<DateKey>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showDays, setShowDays] = useState(false);

  const range = useMemo(() => {
    switch (dateKey) {
      case "7": return { from: shiftIso(todayIso, -6), to: todayIso };
      case "30": return { from: shiftIso(todayIso, -29), to: todayIso };
      case "month": return { from: `${todayIso.slice(0, 8)}01`, to: todayIso };
      case "custom": return { from: from || undefined, to: to || undefined };
      default: return {};
    }
  }, [dateKey, from, to, todayIso]);

  const rows = useMemo(() => filterPremixRows(data.rows, { eventId, ...range }), [data.rows, eventId, range]);
  const summary = useMemo(() => summarisePremix(rows, data.unitCostCents), [rows, data.unitCostCents]);
  const hasUntagged = data.rows.some((r) => r.eventId === null);
  const eventName = (id: string | null) => data.events.find((e) => e.id === id)?.name ?? null;
  const filtered = eventId !== "all" || dateKey !== "all";

  const byDay = useMemo(() => {
    const m = new Map<string, { date: string; qty: number; net: number; events: Set<string | null> }>();
    for (const r of rows) {
      const cur = m.get(r.date) ?? { date: r.date, qty: 0, net: 0, events: new Set() };
      cur.qty += r.qty;
      cur.net += r.netSalesCents;
      cur.events.add(r.eventId);
      m.set(r.date, cur);
    }
    return [...m.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [rows]);

  const eventLabel = eventId === "all" ? "All events" : eventId === "none" ? "No event" : eventName(eventId) ?? "Event";
  const dateLabel =
    dateKey === "custom" && from && from === to
      ? fmtBusinessDate(from, "EEE MMM d")
      : dateKey === "custom" && (from || to)
      ? `${from ? fmtBusinessDate(from, "MMM d") : "Start"} – ${to ? fmtBusinessDate(to, "MMM d") : "Today"}`
      : DATE_LABEL[dateKey];

  const top = summary?.flavours.slice(0, 4) ?? [];
  const max = Math.max(1, ...top.map((f) => f.netSalesCents));

  return (
    <section aria-labelledby="premix-h" className="rounded-[28px] bg-card p-5">
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-muted text-brand-ink">
          <Package className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="premix-h" className="text-sm font-semibold">Premix</h2>
          <p className="text-xs text-muted-foreground">
            {summary ? (
              <>
                {summary.days} day{summary.days === 1 ? "" : "s"} sold
                {summary.events > 0 && <> · {summary.events} event{summary.events === 1 ? "" : "s"}</>}
              </>
            ) : (
              "No sales in this selection"
            )}
          </p>
        </div>
        <Link href="/sales?category=Premix" className="shrink-0 text-xs font-medium text-brand-ink">See items</Link>
      </div>

      {/* Filters: event and date sold. */}
      <div className="mt-4 flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Event: ${eventLabel}. Change event`}
              className={cn(
                "lg-press inline-flex h-9 max-w-[52%] items-center gap-1.5 rounded-full border px-3 text-xs font-medium",
                eventId !== "all" ? "border-transparent bg-foreground text-background" : "border-border hover:bg-muted",
              )}
            >
              {eventId !== "all" && eventId !== "none" && <EventMark name={eventLabel} />}
              <span className="min-w-0 truncate">{eventLabel}</span>
              <ChevronDown aria-hidden className="h-3.5 w-3.5 shrink-0 opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 min-w-56 overflow-y-auto">
            <FilterItem active={eventId === "all"} onSelect={() => setEventId("all")}>All events</FilterItem>
            {data.events.length > 0 && <DropdownMenuSeparator />}
            {data.events.map((e) => (
              <FilterItem key={e.id} active={eventId === e.id} onSelect={() => setEventId(e.id)}>
                <EventMark name={e.name} />
                <span className="min-w-0 truncate">{e.name}</span>
              </FilterItem>
            ))}
            {hasUntagged && (
              <>
                <DropdownMenuSeparator />
                <FilterItem active={eventId === "none"} onSelect={() => setEventId("none")}>No event</FilterItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Date sold: ${dateLabel}. Change dates`}
              className={cn(
                "lg-press inline-flex h-9 min-w-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium",
                dateKey !== "all" ? "border-transparent bg-foreground text-background" : "border-border hover:bg-muted",
              )}
            >
              <CalendarDays aria-hidden className="h-3.5 w-3.5 shrink-0 opacity-70" />
              <span className="truncate">{dateLabel}</span>
              <ChevronDown aria-hidden className="h-3.5 w-3.5 shrink-0 opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-48">
            {(Object.keys(DATE_LABEL) as DateKey[]).map((k) => (
              <FilterItem key={k} active={dateKey === k} onSelect={() => setDateKey(k)}>{DATE_LABEL[k]}</FilterItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {filtered && (
          <button
            type="button"
            onClick={() => { setEventId("all"); setDateKey("all"); setFrom(""); setTo(""); }}
            aria-label="Clear filters"
            title="Clear filters"
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        )}
      </div>

      {dateKey === "custom" && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="text-[11px] text-muted-foreground">
            From
            <input
              type="date"
              value={from}
              max={to || todayIso}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 block h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
            />
          </label>
          <label className="text-[11px] text-muted-foreground">
            To
            <input
              type="date"
              value={to}
              min={from || undefined}
              max={todayIso}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 block h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
            />
          </label>
        </div>
      )}

      {summary ? (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div>
              <div className="text-[11px] text-muted-foreground">Sales</div>
              <div className="display-num text-[22px] font-medium leading-tight tabular-nums">{formatMoney(summary.netSalesCents)}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">Bags</div>
              <div className="display-num text-[22px] font-medium leading-tight tabular-nums">{qty(summary.qty)}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">Profit</div>
              <div className={`display-num text-[22px] font-medium leading-tight tabular-nums ${summary.profitCents < 0 ? "text-destructive" : "text-success"}`}>
                {formatMoney(summary.profitCents, { signed: true })}
              </div>
            </div>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {summary.marginPct !== null && <>{formatPercent(summary.marginPct)} margin · </>}
            {formatMoney(summary.unitCostCents)} a bag to make · {formatMoney(summary.costCents)} total cost
          </p>

          <ul className="mt-4 space-y-2.5">
            {top.map((f) => (
              <li key={f.name}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{f.name}</span>
                  <span className="num shrink-0 tabular-nums text-muted-foreground">
                    {qty(f.qty)} · {formatMoney(f.netSalesCents)} · <span className={`font-semibold ${f.profitCents < 0 ? "text-destructive" : "text-success"}`}>{formatMoney(f.profitCents, { signed: true })}</span>
                  </span>
                </div>
                <div aria-hidden className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-highlight" style={{ width: `${Math.max(3, (f.netSalesCents / max) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
          {summary.flavours.length > top.length && (
            <p className="mt-2 text-xs text-muted-foreground">+ {summary.flavours.length - top.length} more</p>
          )}

          {/* The days it sold, newest first: what "date sold" reads as. */}
          <button
            type="button"
            onClick={() => setShowDays((v) => !v)}
            aria-expanded={showDays}
            className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-brand-ink"
          >
            {showDays ? "Hide days sold" : `Show days sold (${byDay.length})`}
            <ChevronDown aria-hidden className={cn("h-3.5 w-3.5 transition-transform", showDays && "rotate-180")} />
          </button>
          {showDays && (
            <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
              {byDay.map((d) => {
                const names = [...d.events].map((id) => eventName(id)).filter((n): n is string => !!n);
                return (
                  <li key={d.date}>
                    <button
                      type="button"
                      onClick={() => { setDateKey("custom"); setFrom(d.date); setTo(d.date); setShowDays(false); }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-muted"
                      aria-label={`Show only ${fmtBusinessDate(d.date, "EEEE MMM d")}`}
                    >
                      <span className="w-20 shrink-0 text-sm">{fmtBusinessDate(d.date, "EEE MMM d")}</span>
                      <span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-muted-foreground">
                        {names.slice(0, 2).map((n) => <EventMark key={n} name={n} />)}
                        <span className="min-w-0 truncate">{names.length ? names.join(", ") : "No event"}</span>
                      </span>
                      <span className="num shrink-0 text-xs tabular-nums text-muted-foreground">
                        {qty(d.qty)} · <span className="text-foreground">{formatMoney(d.net)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : (
        <p className="mt-4 rounded-2xl bg-muted px-4 py-5 text-center text-sm text-muted-foreground">
          No premix sold {eventId !== "all" ? `at ${eventLabel}` : ""} {dateKey !== "all" ? "in these dates" : ""}.
        </p>
      )}
    </section>
  );
}

function FilterItem({ active, onSelect, children }: { active: boolean; onSelect: () => void; children: React.ReactNode }) {
  return (
    <DropdownMenuItem onSelect={onSelect} aria-current={active ? "true" : undefined} className="gap-2">
      <span className={cn("flex min-w-0 flex-1 items-center gap-2", active && "font-semibold")}>{children}</span>
      {active ? <Check aria-hidden className="h-3.5 w-3.5 shrink-0 text-brand-ink" /> : <span aria-hidden className="w-3.5 shrink-0" />}
    </DropdownMenuItem>
  );
}
