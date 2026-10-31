"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney, formatPercent } from "@/lib/money";
import type { PnlColumn } from "@/modules/reports/queries";

/*
  The P&L statement — the Overview's centrepiece.

  It is a CSS grid rather than a <table> because the column count is the number
  of events in range, which the label column has to give way to. Semantics are
  kept with an explicit row/cell role set so it still reads as a table to a
  screen reader.

  Three interactions:
  - Click a row label to sort the event columns by that line. Overall never
    moves; it is a total, not a competitor.
  - Hover anywhere to cross-highlight that row and column, so the eye does not
    lose the line across a dozen events.
  - Click an event heading to open that event in full.

  Below `lg` the grid can't hold the columns, so the statement is replaced by
  one card per event — the same treatment the rest of the app's wide tables
  already use.
*/

// Fallbacks when an event carries no colour of its own: logo brown, gold,
// logo rust, taupe — the four the handoff legend uses, in that order.
const FALLBACK_SWATCH = [
  "hsl(var(--espresso))",
  "hsl(var(--amber-deep))",
  "hsl(var(--brand))",
  "hsl(var(--ink-300))",
];

type Line = {
  key: string;
  label: string;
  /** Sub-lines of net sales are indented and set in muted ink. */
  indent?: boolean;
  /** A running total drawn off the lines above it, not a cost of its own. */
  subtotal?: boolean;
  /** Costs render as negatives. */
  negate?: boolean;
  value: (c: PnlColumn) => number;
  format?: (n: number) => string;
};

const LINES: Line[] = [
  { key: "txns", label: "Transactions", value: (c) => c.txns, format: (n) => n.toLocaleString() },
  { key: "net", label: "Net sales", value: (c) => c.netSalesCents },
  { key: "cogs", label: "Cost of goods", indent: true, negate: true, value: (c) => c.cogsCents },
  // The line the split exists to make honest: everything above it was consumed
  // making what was sold, everything below it is the cost of being open.
  { key: "gross", label: "Gross profit", subtotal: true, value: (c) => c.grossProfitCents },
  { key: "labor", label: "Labor", indent: true, negate: true, value: (c) => c.laborCents },
  { key: "opex", label: "Operating expenses", indent: true, negate: true, value: (c) => c.opexCents },
  { key: "fees", label: "Event fees", indent: true, negate: true, value: (c) => c.feeCents },
];

// Every sortable line, including the three that aren't in LINES.
const SORTERS: Record<string, (c: PnlColumn) => number> = {
  ...Object.fromEntries(LINES.map((l) => [l.key, l.value])),
  profit: (c) => c.profitCents,
  margin: (c) => c.marginPct,
  tips: (c) => c.tipsCents,
};

type Sort = { key: string; dir: "asc" | "desc" };

function money(n: number) {
  return n === 0 ? "—" : formatMoney(n);
}

export function PnlStatement({ columns }: { columns: PnlColumn[] }) {
  const [sort, setSort] = React.useState<Sort | null>(null);
  const [hot, setHot] = React.useState<{ row: string | null; col: string | null }>({
    row: null,
    col: null,
  });

  const overall = columns.find((c) => c.key === "overall");
  const baseEvents = React.useMemo(() => columns.filter((c) => c.key !== "overall"), [columns]);

  const events = React.useMemo(() => {
    if (!sort) return baseEvents;
    const read = SORTERS[sort.key];
    if (!read) return baseEvents;
    // Costs are stored positive, so "biggest cost first" is the natural read of
    // descending on those lines too — no sign flipping needed.
    return [...baseEvents].sort((a, b) =>
      sort.dir === "desc" ? read(b) - read(a) : read(a) - read(b),
    );
  }, [baseEvents, sort]);

  if (!overall) return null;

  // Third click clears the sort and restores the events' own chronology.
  const toggleSort = (key: string) =>
    setSort((s) =>
      !s || s.key !== key ? { key, dir: "desc" } : s.dir === "desc" ? { key, dir: "asc" } : null,
    );

  const swatch = (c: PnlColumn, i: number) => c.color ?? FALLBACK_SWATCH[i % FALLBACK_SWATCH.length];
  // The grid template is sized from the live event count, so two events don't
  // leave four columns of dead space.
  const gridVars = { "--ledger-cols": events.length } as React.CSSProperties;

  // One delegated listener rather than a pair on all ~130 cells.
  const onOver = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    const cell = t.closest<HTMLElement>("[data-col]");
    const row = t.closest<HTMLElement>("[data-row-key]");
    const next = { row: row?.dataset.rowKey ?? null, col: cell?.dataset.col ?? null };
    setHot((prev) => (prev.row === next.row && prev.col === next.col ? prev : next));
  };

  const rowProps = (key: string) => ({
    "data-row-key": key,
    "data-hot": hot.row === key ? "1" : undefined,
  });
  const cellProps = (col: string) => ({
    "data-col": col,
    "data-hot": hot.col === col ? "1" : undefined,
  });

  return (
    <>
      {/* ── Desktop: the statement proper ─────────────────────────────── */}
      {/* The panel is what makes the pinned columns possible: a sticky cell
          needs an opaque background, and it cannot reproduce the canvas
          gradient behind itself. */}
      <div className="panel hidden overflow-hidden lg:block">
        {/* The scrollport is its own focusable region so the statement can be
            scrolled from the keyboard. role="table" stays on the element that
            actually holds the rows — a role-less div between a table and its
            rows breaks the accessibility tree. */}
        <div
          className="overflow-x-auto scroll-contain"
          role="region"
          aria-label="Profit and loss statement, scrollable"
          tabIndex={0}
        >
          <div
            style={gridVars}
            className="num min-w-max text-[13px]"
            role="table"
            aria-label="Profit and loss by event"
            onMouseOver={onOver}
            onMouseLeave={() => setHot({ row: null, col: null })}
          >
            {/* Column heads, doubling as the event colour legend. */}
            <div
              role="row"
              {...rowProps("head")}
              className="ledger-row border-b border-espresso pb-2 pt-2 text-xs text-muted-foreground"
            >
              <span role="columnheader" {...cellProps("line")}>
                Line
              </span>
              {events.map((c, i) => (
                <span key={c.key} role="columnheader" {...cellProps(c.key)} className="truncate">
                  {/* Opens everything recorded against this event. */}
                  <Link
                    href={`/events/${encodeURIComponent(c.key)}`}
                    title={`Open ${c.name} — sales, items, invoices, labor and cash`}
                    className="flex items-center justify-end gap-1.5 rounded transition-colors hover:text-foreground"
                  >
                    <span
                      aria-hidden
                      className="h-2 w-2 shrink-0 rounded-[2px]"
                      style={{ background: swatch(c, i) }}
                    />
                    <span className="truncate">{c.name}</span>
                  </Link>
                </span>
              ))}
              <span
                role="columnheader"
                {...cellProps("overall")}
                className="text-right font-semibold text-foreground"
              >
                Overall
              </span>
            </div>

            {LINES.map((line) => (
              <div
                key={line.key}
                role="row"
                {...rowProps(line.key)}
                className={cn(
                  "ledger-row border-b border-input py-[11px]",
                  line.subtotal && "border-t border-espresso",
                )}
              >
                <SortLabel
                  line={line.key}
                  label={line.label}
                  sort={sort}
                  onToggle={toggleSort}
                  className={line.indent ? "pl-3.5 text-muted-foreground" : "font-semibold"}
                  cellProps={cellProps}
                />
                {events.map((c) => (
                  <Cell key={c.key} line={line} col={c} muted={line.indent} cellProps={cellProps} />
                ))}
                <Cell line={line} col={overall} strong={!line.indent} cellProps={cellProps} />
              </div>
            ))}

            {/* Profit — the one row the eye should land on first. */}
            <div
              role="row"
              {...rowProps("profit")}
              className="ledger-row ledger-highlight border-b-2 border-espresso py-[13px]"
            >
              <SortLabel
                line="profit"
                label="Profit"
                sort={sort}
                onToggle={toggleSort}
                className="font-bold"
                cellProps={cellProps}
              />
              {events.map((c) => (
                <span
                  key={c.key}
                  role="cell"
                  {...cellProps(c.key)}
                  className={cn("text-right font-semibold", signTone(c.profitCents))}
                >
                  {formatMoney(c.profitCents, { signed: true })}
                </span>
              ))}
              <span
                role="cell"
                {...cellProps("overall")}
                className="display-num text-right text-base font-bold"
              >
                {formatMoney(overall.profitCents, { signed: true })}
              </span>
            </div>

            <div
              role="row"
              {...rowProps("margin")}
              className="ledger-row border-b border-input py-[11px]"
            >
              <SortLabel
                line="margin"
                label="Margin"
                sort={sort}
                onToggle={toggleSort}
                className="text-muted-foreground"
                cellProps={cellProps}
              />
              {events.map((c) => (
                <span
                  key={c.key}
                  role="cell"
                  {...cellProps(c.key)}
                  className={cn("text-right", c.marginPct < 0 && "text-destructive")}
                >
                  {formatPercent(c.marginPct)}
                </span>
              ))}
              <span
                role="cell"
                {...cellProps("overall")}
                className={cn("text-right font-semibold", overall.marginPct < 0 && "text-destructive")}
              >
                {formatPercent(overall.marginPct)}
              </span>
            </div>

            <div
              role="row"
              {...rowProps("tips")}
              className="ledger-row py-[11px] text-xs text-muted-foreground"
            >
              <SortLabel
                line="tips"
                label="Tips (staff, not in profit)"
                sort={sort}
                onToggle={toggleSort}
                className="text-muted-foreground"
                cellProps={cellProps}
              />
              {events.map((c) => (
                <span key={c.key} role="cell" {...cellProps(c.key)} className="text-right">
                  {money(c.tipsCents)}
                </span>
              ))}
              <span role="cell" {...cellProps("overall")} className="text-right">
                {money(overall.tipsCents)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile: one card per event, plus the overall column ────────── */}
      <div className="space-y-2.5 lg:hidden">
        {[...baseEvents, overall].map((c, i) => (
          <div key={c.key} className={cn("panel p-4", c.key === "overall" && "border-espresso")}>
            <div className="flex items-center justify-between gap-3">
              {c.key === "overall" ? (
                <span className="truncate text-sm font-semibold">{c.name}</span>
              ) : (
                <Link href={`/events/${encodeURIComponent(c.key)}`} className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-[2px]"
                    style={{ background: swatch(c, i) }}
                  />
                  <span className="truncate text-sm font-semibold" title={c.name}>
                    {c.name}
                  </span>
                </Link>
              )}
              <span className="num shrink-0 text-sm text-muted-foreground">
                {c.txns.toLocaleString()} txns
              </span>
            </div>
            <dl className="num mt-3 space-y-1.5 text-[13px]">
              <MobileLine label="Net sales" value={money(c.netSalesCents)} strong />
              {/* Lines with nothing recorded are dropped on phones, where four
                  rows of em-dashes was most of the card's height. */}
              {c.cogsCents > 0 && <MobileLine label="Cost of goods" value={neg(c.cogsCents)} muted />}
              {/* Only where there is a cost of goods to have taken off — on a
                  card with none it would just repeat net sales. */}
              {c.cogsCents > 0 && (
                <MobileLine label="Gross profit" value={formatMoney(c.grossProfitCents)} strong />
              )}
              {c.laborCents > 0 && <MobileLine label="Labor" value={neg(c.laborCents)} muted />}
              {c.opexCents > 0 && <MobileLine label="Operating expenses" value={neg(c.opexCents)} muted />}
              {c.feeCents > 0 && <MobileLine label="Event fees" value={neg(c.feeCents)} muted />}
              {c.cogsCents + c.laborCents + c.opexCents + c.feeCents === 0 && (
                <MobileLine label="No costs recorded" value="" muted />
              )}
            </dl>
            <div className="ledger-highlight mt-3 flex items-baseline justify-between rounded-lg px-3 py-2.5">
              <dt className="text-[13px] font-bold">Profit</dt>
              <dd className={cn("display-num text-base font-bold", signTone(c.profitCents))}>
                {formatMoney(c.profitCents, { signed: true })}{" "}
                <span className="text-xs font-medium">({formatPercent(c.marginPct)})</span>
              </dd>
            </div>
            <div className="mt-2 flex items-baseline justify-between text-xs text-muted-foreground">
              <span>Tips (staff, not in profit)</span>
              <span className="num">{money(c.tipsCents)}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function signTone(cents: number) {
  return cents < 0 ? "text-destructive" : cents > 0 ? "text-success" : "";
}

function neg(cents: number) {
  return cents === 0 ? "—" : formatMoney(-cents);
}

/** Row label that doubles as the sort control for its line. */
function SortLabel({
  line,
  label,
  sort,
  onToggle,
  className,
  cellProps,
}: {
  line: string;
  label: string;
  sort: Sort | null;
  onToggle: (key: string) => void;
  className?: string;
  cellProps: (col: string) => Record<string, string | undefined>;
}) {
  const active = sort?.key === line;
  return (
    <span role="rowheader" {...cellProps("line")} aria-sort={ariaSort(sort, line)}>
      <button
        type="button"
        onClick={() => onToggle(line)}
        title={`Sort events by ${label.toLowerCase()}`}
        className={cn(
          "group flex w-full items-center gap-1 truncate whitespace-nowrap rounded text-left transition-colors hover:text-foreground",
          className,
        )}
      >
        <span className="truncate">{label}</span>
        {active ? (
          sort!.dir === "desc" ? (
            <ArrowDown className="h-3 w-3 shrink-0 text-brand-ink" aria-hidden />
          ) : (
            <ArrowUp className="h-3 w-3 shrink-0 text-brand-ink" aria-hidden />
          )
        ) : (
          <ArrowDown
            className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-40"
            aria-hidden
          />
        )}
      </button>
    </span>
  );
}

function ariaSort(sort: Sort | null, line: string): "ascending" | "descending" | "none" {
  if (sort?.key !== line) return "none";
  return sort.dir === "desc" ? "descending" : "ascending";
}

function Cell({
  line,
  col,
  muted,
  strong,
  cellProps,
}: {
  line: Line;
  col: PnlColumn;
  muted?: boolean;
  strong?: boolean;
  cellProps: (col: string) => Record<string, string | undefined>;
}) {
  const raw = line.value(col);
  const n = line.negate ? -raw : raw;
  const text = line.format ? (raw === 0 ? "—" : line.format(raw)) : money(n);
  return (
    <span
      role="cell"
      {...cellProps(col.key)}
      className={cn("truncate text-right", muted && "text-muted-foreground", strong && "font-semibold")}
    >
      {text}
    </span>
  );
}

function MobileLine({
  label,
  value,
  muted,
  strong,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={cn("truncate", muted && "text-muted-foreground", strong && "font-semibold")}>
        {label}
      </dt>
      <dd className={cn("shrink-0", strong && "font-semibold")}>{value}</dd>
    </div>
  );
}
