"use client";
import * as React from "react";
import { Check, ChevronsUpDown, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatMoney } from "@/lib/money";
import { markerColor } from "@/lib/event-color";
import { useSwipe } from "@/lib/use-swipe";

/*
  Where the money went — one list you steer, instead of two grids you scroll.

  The old layout was two tables (suppliers × events, categories × events), each
  with a column per event plus "shared", "untagged" and "total". On a phone that
  is a spreadsheet seen through a letterbox. Here you pick WHAT to look at
  (suppliers or categories) and WHICH slice (everything, one event, shared,
  untagged), and get a single ranked list: biggest first, a bar to compare at a
  glance, the amount on the right.

  It is the same data, cut the same way, with the same totals. Only the reading
  order changed: you ask a question and get one column's worth of answer.
*/

export type SpendEvent = { id: string; name: string; color: string | null };
export type SpendRow = {
  key: string;
  name: string;
  byEvent: Record<string, number>;
  sharedCents: number;
  untaggedCents: number;
  totalCents: number;
};
export type SpendTable = {
  events: SpendEvent[];
  rows: SpendRow[];
  eventTotals: Record<string, number>;
  grandShared: number;
  grandUntagged: number;
  grandTotal: number;
};

type Lens = "suppliers" | "categories";
type Slice = { id: string; label: string; color?: string | null; total: number; pick: (r: SpendRow) => number };

function slicesOf(t: SpendTable): Slice[] {
  const out: Slice[] = [{ id: "all", label: "All", total: t.grandTotal, pick: (r) => r.totalCents }];
  for (const e of t.events) {
    out.push({ id: e.id, label: e.name, color: markerColor(e.color), total: t.eventTotals[e.id] ?? 0, pick: (r) => r.byEvent[e.id] ?? 0 });
  }
  if (t.grandShared > 0) out.push({ id: "shared", label: "All events (shared)", total: t.grandShared, pick: (r) => r.sharedCents });
  if (t.grandUntagged > 0) out.push({ id: "untagged", label: "Untagged", total: t.grandUntagged, pick: (r) => r.untaggedCents });
  return out;
}

export function SpendExplorer({ suppliers, categories }: { suppliers: SpendTable; categories: SpendTable }) {
  const [lens, setLens] = React.useState<Lens>("suppliers");
  const [sliceId, setSliceId] = React.useState("all");
  const tabsId = React.useId();

  const table = lens === "suppliers" ? suppliers : categories;
  const slices = React.useMemo(() => slicesOf(table), [table]);
  // Suppliers and categories can have different events attached; if the chosen
  // slice does not exist on the other lens, fall back to "All" rather than show nothing.
  const slice = slices.find((s) => s.id === sliceId) ?? slices[0];

  const ranked = table.rows
    .map((r) => ({ r, cents: slice.pick(r) }))
    .filter((x) => x.cents > 0)
    .sort((a, b) => b.cents - a.cents || a.r.name.localeCompare(b.r.name));
  const top = ranked[0]?.cents ?? 0;

  const swipe = useSwipe({ onLeft: () => setLens("categories"), onRight: () => setLens("suppliers") });
  const lensTabs: { id: Lens; label: string }[] = [
    { id: "suppliers", label: "By supplier" },
    { id: "categories", label: "By category" },
  ];

  return (
    <div className="space-y-4">
      {/* What to look at */}
      <div role="tablist" aria-label="Group spend by" className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
        {lensTabs.map((t) => {
          const on = lens === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              id={`${tabsId}-${t.id}`}
              aria-selected={on}
              aria-controls={`${tabsId}-panel`}
              onClick={() => setLens(t.id)}
              className={cn(
                "min-h-10 rounded-full px-3 text-sm font-medium transition-colors duration-150",
                on ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/*
        Which slice. One control that opens a list, instead of a row of up to
        twenty chips: it shows what is selected and its total, and the list
        carries each option's amount so you can see where the money is before
        choosing.
      */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Showing ${slice.label}. Change which event or group of spend this shows`}
            className="lg-press flex min-h-11 w-full items-center gap-2.5 rounded-full border border-border bg-card px-4 text-left text-sm hover:bg-muted"
          >
            {slice.color ? (
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
            ) : (
              <Layers aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="min-w-0 flex-1 truncate font-medium">{slice.id === "all" ? "All spend" : slice.label}</span>
            <ChevronsUpDown aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-[60vh] w-[var(--radix-dropdown-menu-trigger-width)] min-w-64 overflow-y-auto">
          {slices.map((s, i) => {
            const on = s.id === slice.id;
            return (
              <React.Fragment key={s.id}>
                {i === 1 && <DropdownMenuSeparator />}
                <DropdownMenuItem onSelect={() => setSliceId(s.id)} className="gap-2.5">
                  {s.color ? (
                    <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  ) : (
                    <span aria-hidden className="h-2 w-2 shrink-0" />
                  )}
                  <span className={cn("min-w-0 flex-1 truncate", on && "font-semibold")}>{s.id === "all" ? "All spend" : s.label}</span>
                  <span className="num shrink-0 text-xs text-muted-foreground">{formatMoney(s.total)}</span>
                  {on && <Check aria-hidden className="h-3.5 w-3.5 shrink-0 text-brand-ink" />}
                </DropdownMenuItem>
              </React.Fragment>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* The answer */}
      <div
        role="tabpanel"
        id={`${tabsId}-panel`}
        aria-labelledby={`${tabsId}-${lens}`}
        aria-live="polite"
        {...swipe}
      >
        <p className="text-xs text-muted-foreground">{slice.id === "all" ? "Total spend" : slice.label}</p>
        <p className="display-num text-[28px] font-medium leading-tight tracking-[-0.025em] tabular-nums">{formatMoney(slice.total)}</p>

        {ranked.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nothing here yet.</p>
        ) : (
          <ol className="mt-3 divide-y divide-border-soft">
            {ranked.map(({ r, cents }) => (
              <li key={r.key} className="py-3">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="min-w-0 break-words text-sm font-medium">{r.name}</span>
                  <span className="num shrink-0 text-sm font-semibold tabular-nums">{formatMoney(cents)}</span>
                </div>
                <div aria-hidden className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-brand-ink" style={{ width: `${Math.max(2, (cents / top) * 100)}%` }} />
                </div>
                {slice.total > 0 && (
                  <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">{Math.round((cents / slice.total) * 100)}% of {slice.id === "all" ? "spend" : slice.label}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
