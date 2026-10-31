import Link from "next/link";
import { Download } from "lucide-react";
import { requireCapability } from "@/lib/scope";
import { resolveEventScope, listEventOptions } from "@/modules/dashboard/event-scope";
import { getActiveEvent } from "@/modules/events/queries";
import { getSalesBreakdown, type SalesSort } from "@/modules/sales/queries";
import { categoryStyle } from "@/modules/items/categories";
import { PageHeader } from "@/components/page-header";
import { EventControl } from "@/components/dashboard/event-control";
import { StickyToolbar } from "@/components/sticky-toolbar";
import { StatTile, StatTileRow } from "@/components/stat-tile";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableOnDesktop, MobileList, MobileRow, MobileField, MobileEmpty } from "@/components/mobile-list";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatPercent } from "@/lib/money";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SORTS: { key: SalesSort; label: string }[] = [
  { key: "revenue", label: "Revenue" },
  { key: "profit", label: "Profit" },
  { key: "qty", label: "Units" },
  { key: "name", label: "Name" },
];

/** Quantities come from Square as a Float, so 1.5 lb of something is real. */
const qtyFmt = (n: number) => (Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1));

/*
  Sales — what actually sold, by item and by category.

  Reads the same resolved date window as the Overview (same query string, same
  period control), so the two pages cannot disagree about what "this month"
  means. The category rollup is the point of the page: the Overview can tell
  you the top seller, but not whether the season was carried by hot chai or
  cold.
*/
export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, scope] = await Promise.all([searchParams, requireCapability("financials")]);
  const activeEvent = await getActiveEvent(scope.businessId);
  const [range, eventOptions] = await Promise.all([
    resolveEventScope(scope.businessId, params, activeEvent),
    listEventOptions(scope.businessId),
  ]);

  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const sort = (SORTS.find((s) => s.key === one(params.sort))?.key ?? "revenue") as SalesSort;
  const category = one(params.category) ?? null;

  const data = await getSalesBreakdown({
    locationId: scope.locationId,
    from: range.start,
    to: range.end,
    eventId: range.eventId,
    category,
    sort,
  });

  // Links have to carry the period, or changing the sort would silently throw
  // the chosen window away and re-render a different set of numbers.
  const linkWith = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      const s = one(v);
      if (s && ["event", "sort", "category"].includes(k)) q.set(k, s);
    }
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) q.delete(k);
      else q.set(k, v);
    }
    const s = q.toString();
    return s ? `/sales?${s}` : "/sales";
  };

  const avgItemValue = data.totals.qty > 0 ? data.totals.netSalesCents / data.totals.qty : 0;

  return (
    <div>
      <PageHeader
        eyebrow={range.label}
        title="Sales"
        description={`${range.subLabel} · ${data.totals.dayCount} day${data.totals.dayCount === 1 ? "" : "s"} with sales`}
      />

      {/* The item list runs long, so the period control and the export stay
          pinned under the header rather than scrolling away with the title. */}
      <StickyToolbar>
        <EventControl
          events={eventOptions}
          activeKey={range.key}
          activeLabel={range.label}
          basePath="/sales"
        />
        <Button asChild variant="outline" size="sm">
          <a href="/api/exports/sales-items" download>
            <Download className="h-3.5 w-3.5" /> CSV
          </a>
        </Button>
      </StickyToolbar>

      <div className="mx-auto max-w-[1400px] space-y-5 px-4 pb-12 pt-5 sm:px-6 lg:px-8">
        <StatTileRow>
          <StatTile label="Net sales" value={formatMoney(data.totals.netSalesCents)} />
          <StatTile label="Units sold" value={qtyFmt(data.totals.qty)} />
          <StatTile
            label="Gross profit"
            value={data.totals.marginPct === null ? "—" : formatMoney(data.totals.profitCents)}
          />
          <StatTile
            label="Margin"
            value={data.totals.marginPct === null ? "—" : formatPercent(data.totals.marginPct)}
          />
        </StatTileRow>

        {/* Says what the margin is actually over. A figure computed across only
            the costed items, presented without that, invites reading it as the
            whole business. */}
        {data.totals.uncostedItemCount > 0 ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {data.totals.costedItemCount > 0 ? (
              <>
                Profit and margin cover the{" "}
                <span className="text-foreground">{data.totals.costedItemCount}</span> item
                {data.totals.costedItemCount === 1 ? "" : "s"} with a recipe against{" "}
                {data.totals.costedItemCount === 1 ? "it" : "them"} —{" "}
                <span className="text-foreground">{formatMoney(data.totals.costedNetSalesCents)}</span>{" "}
                of {formatMoney(data.totals.netSalesCents)} in sales.{" "}
              </>
            ) : (
              /* Nothing is costed at all, so there is no slice to describe —
                 the columns are simply blank, and saying which items would
                 fill them is the only useful thing left to say. */
              <>
                Nothing here is costed yet, so the cost, profit and margin columns are blank on{" "}
                <span className="text-foreground">{formatMoney(data.totals.netSalesCents)}</span> of
                sales.{" "}
              </>
            )}
            {/* The item worth doing first, by name and by what it is worth.
                A bare count is the same sentence whether the missing recipes
                add up to $40 or $15,000. */}
            {data.totals.topUncosted.length > 0 && (
              <>
                <span className="text-foreground">{data.totals.uncostedItemCount}</span> item
                {data.totals.uncostedItemCount === 1 ? "" : "s"} still{" "}
                {data.totals.uncostedItemCount === 1 ? "has" : "have"} no recipe, worth{" "}
                <span className="text-foreground">
                  {formatMoney(data.totals.uncostedNetSalesCents)}
                </span>{" "}
                between {data.totals.uncostedItemCount === 1 ? "it" : "them"}. Start with{" "}
                {data.totals.topUncosted.map((u, n) => (
                  <span key={u.itemName}>
                    {n > 0 && (n === data.totals.topUncosted.length - 1 ? " and " : ", ")}
                    <span className="text-foreground">{u.itemName}</span> (
                    {formatMoney(u.netSalesCents)})
                  </span>
                ))}
                .{" "}
              </>
            )}
            <Link href="/recipes" className="text-brand-ink hover:underline">
              Build the recipe
            </Link>
            , then{" "}
            <Link href="/settings/integrations" className="text-brand-ink hover:underline">
              link it to the item
            </Link>
            .
          </p>
        ) : (
          data.totals.itemCount > 0 && (
            <p className="text-xs text-muted-foreground">
              Every item is costed from its recipe, so profit moves on its own as ingredient
              prices change.
            </p>
          )
        )}

        {/* ── Categories ─────────────────────────────────────────────── */}
        <div className="bento p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">By category</h2>
            {category && (
              <Link href={linkWith({ category: null })} className="text-xs text-brand-ink hover:underline">
                Clear filter
              </Link>
            )}
          </div>

          {data.byCategory.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No item sales in this period. Item data arrives with the Square item-summary import
              under Settings → Integrations.
            </p>
          ) : (
            <div className="mt-4 space-y-2.5">
              {data.byCategory.map((c) => {
                const style = categoryStyle(c.category);
                const selected = category === c.category;
                return (
                  <Link
                    key={c.category}
                    href={linkWith({ category: selected ? null : c.category })}
                    aria-pressed={selected}
                    className={cn(
                      "block rounded-xl border px-3 py-2.5 transition-colors",
                      selected ? "border-foreground/25 bg-accent" : "border-transparent hover:bg-accent/60",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-[3px]", style.dot)} />
                        <span className="truncate font-medium">{c.category}</span>
                        <span className="shrink-0 text-2xs text-muted-foreground">
                          {c.itemCount} item{c.itemCount === 1 ? "" : "s"}
                        </span>
                      </span>
                      <span className="num shrink-0 text-right">
                        <span className="font-semibold">{formatMoney(c.netSalesCents)}</span>
                        {c.marginPct !== null && (
                          <span className="ml-2 text-2xs text-success">
                            {formatPercent(c.marginPct)} margin
                            {/* Named when it is only part of the category, so
                                one costed item out of three cannot be read as
                                the whole category's margin. */}
                            {c.costedItemCount < c.itemCount && (
                              <span className="text-muted-foreground">
                                {" "}on {c.costedItemCount} of {c.itemCount}
                              </span>
                            )}
                          </span>
                        )}
                        <span className="ml-2 text-2xs text-muted-foreground">{c.sharePct.toFixed(1)}%</span>
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2.5">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-beige">
                        <div
                          className={cn("h-full rounded-full", style.bar)}
                          style={{ width: `${Math.max(c.sharePct, 1.5)}%` }}
                        />
                      </div>
                      <span className="num w-20 shrink-0 text-right text-2xs text-muted-foreground">
                        {qtyFmt(c.qty)} units
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Items ──────────────────────────────────────────────────── */}
        <div className="bento">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-5">
            <h2 className="text-sm font-semibold">
              {category ? `${category} items` : "Every item"}
              <span className="ml-2 text-2xs font-normal text-muted-foreground">
                {data.filteredCount} row{data.filteredCount === 1 ? "" : "s"}
              </span>
            </h2>
            <div className="flex items-center gap-1 text-2xs">
              <span className="text-muted-foreground">Sort</span>
              {SORTS.map((s) => (
                <Link
                  key={s.key}
                  href={linkWith({ sort: s.key })}
                  aria-current={sort === s.key ? "true" : undefined}
                  className={cn(
                    "rounded-md px-2 py-1 transition-colors",
                    sort === s.key ? "bg-espresso font-semibold text-espresso-foreground" : "hover:bg-accent",
                  )}
                >
                  {s.label}
                </Link>
              ))}
            </div>
          </div>

          <TableOnDesktop>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Net sales</TableHead>
                  <TableHead className="text-right">Unit cost</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((i) => (
                  <TableRow key={i.itemName}>
                    <TableCell className="font-medium">{i.itemName}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className={cn("h-2 w-2 rounded-[2px]", categoryStyle(i.category).dot)} />
                        {i.category}
                      </span>
                    </TableCell>
                    <TableCell className="num text-right">{qtyFmt(i.qty)}</TableCell>
                    <TableCell className="num text-right font-medium">{formatMoney(i.netSalesCents)}</TableCell>
                    <TableCell className="num text-right text-muted-foreground" title={i.recipeName ?? undefined}>
                      {i.unitCostCents === null ? "—" : formatMoney(i.unitCostCents)}
                    </TableCell>
                    <TableCell className="num text-right text-muted-foreground">
                      {i.costCents === null ? "—" : formatMoney(i.costCents)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "num text-right font-medium",
                        i.profitCents !== null && i.profitCents < 0 && "text-destructive",
                      )}
                    >
                      {i.profitCents === null ? (
                        <span className="font-normal text-muted-foreground">Not costed</span>
                      ) : (
                        formatMoney(i.profitCents, { signed: true })
                      )}
                    </TableCell>
                    <TableCell className="num text-right text-muted-foreground">
                      {i.marginPct === null ? "—" : formatPercent(i.marginPct)}
                    </TableCell>
                    <TableCell className="num text-right text-muted-foreground">{i.sharePct.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
                {data.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-xs text-muted-foreground">
                      Nothing sold in this period{category ? ` in ${category}` : ""}.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableOnDesktop>

          <MobileList>
            {data.items.map((i) => (
              <MobileRow
                key={i.itemName}
                title={i.itemName}
                subtitle={`${qtyFmt(i.qty)} units · ${i.sharePct.toFixed(1)}% of sales`}
                badges={<Badge variant="muted">{i.category}</Badge>}
              >
                <MobileField label="Net sales" value={formatMoney(i.netSalesCents)} />
                <MobileField
                  label="Profit"
                  value={
                    i.profitCents === null
                      ? "Not costed"
                      : `${formatMoney(i.profitCents, { signed: true })}${i.marginPct !== null ? ` · ${formatPercent(i.marginPct)}` : ""}`
                  }
                />
              </MobileRow>
            ))}
            {data.items.length === 0 && (
              <MobileEmpty>Nothing sold in this period{category ? ` in ${category}` : ""}.</MobileEmpty>
            )}
          </MobileList>
        </div>
      </div>
    </div>
  );
}
