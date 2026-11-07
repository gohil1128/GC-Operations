import Link from "next/link";
import { requireCapability } from "@/lib/scope";
import { weeklyTrend, purchaseSpendByPeriod, supplierSpendByEvent, categorySpendByEvent, pnlByEvent } from "@/modules/reports/queries";
import { getLaborReport } from "@/modules/labor/queries";
import { getVarianceReport } from "@/modules/inventory/queries";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { formatMoney, formatPercent } from "@/lib/money";
import { PrintButton } from "@/components/print-button";
import { PnlLock } from "@/components/pnl-lock";
import { EventPnlCards } from "./_components/event-pnl-cards";
import { SpendExplorer, type SpendTable } from "./_components/spend-explorer";
import { BreakdownToggle } from "./_components/breakdown-toggle";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const scope = await requireCapability("financials");
  const [weekly, labor, spend, variance, supplierMatrix, categoryMatrix, pnl] = await Promise.all([
    weeklyTrend(scope.locationId, 4),
    getLaborReport(scope.locationId, 14),
    purchaseSpendByPeriod(scope.locationId, 30),
    getVarianceReport(scope.locationId),
    supplierSpendByEvent(scope.locationId),
    categorySpendByEvent(scope.locationId),
    pnlByEvent(scope.businessId, scope.locationId),
  ]);

  // Both matrices share one shape so a single explorer can show either.
  const bySupplier: SpendTable = {
    events: supplierMatrix.events,
    rows: supplierMatrix.suppliers.map((s) => ({ key: s.supplierId, name: s.name, byEvent: s.byEvent, sharedCents: s.sharedCents, untaggedCents: s.untaggedCents, totalCents: s.totalCents })),
    eventTotals: supplierMatrix.eventTotals,
    grandShared: supplierMatrix.grandShared,
    grandUntagged: supplierMatrix.grandUntagged,
    grandTotal: supplierMatrix.grandTotal,
  };
  const byCategory: SpendTable = {
    events: categoryMatrix.events,
    rows: categoryMatrix.categories.map((c) => ({ key: c.category, name: c.category, byEvent: c.byEvent, sharedCents: c.sharedCents, untaggedCents: c.untaggedCents, totalCents: c.totalCents })),
    eventTotals: categoryMatrix.eventTotals,
    grandShared: categoryMatrix.grandShared,
    grandUntagged: categoryMatrix.grandUntagged,
    grandTotal: categoryMatrix.grandTotal,
  };
  const noPnl = pnl.length <= 1 && (pnl[0]?.netSalesCents ?? 0) === 0;
  const noSpend = bySupplier.rows.length === 0 && byCategory.rows.length === 0;

  return (
    <div>
      <PageHeader
        eyebrow="Sales · Reports"
        title="Reports"
        description="Profit by event, where the money went, labor and stock"
        actions={
          <>
            <PrintButton />
            <PnlLock userId={scope.userId} />
            <Button asChild variant="outline" size="sm">
              <a href="/api/exports/pnl" download><Download className="h-3.5 w-3.5" />Download CSV</a>
            </Button>
          </>
        }
      />
      <div className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)] gap-4 px-4 pb-10 pt-5 sm:px-6 lg:px-8">
        {/* Profit and loss: one card per event, best first */}
        <section aria-labelledby="pnl-h" className="space-y-3">
          <div className="px-1">
            <h2 id="pnl-h" className="font-display text-lg font-semibold tracking-[-0.01em]">Profit &amp; loss by event</h2>
            <BreakdownToggle label="How this is worked out" className="-mx-1 max-w-prose">
              <p className="px-1 pb-2 text-xs leading-relaxed text-muted-foreground">
                Sales minus supplier invoices, labor, expenses and event fees. Each item counts toward the
                event it is tagged to (labor uses the event&apos;s dates); invoices tagged &quot;All events&quot; are
                split evenly across events. The total at the top covers everything, including untagged items.
                Tips are shown for reference — they belong to staff, not profit.
              </p>
            </BreakdownToggle>
          </div>
          {noPnl ? (
            <Card><CardContent className="pt-6 text-sm text-muted-foreground">No data yet — import sales and enter invoices to see your P&amp;L.</CardContent></Card>
          ) : (
            <EventPnlCards columns={pnl} />
          )}
        </section>

        {/* Where the money went */}
        <Card>
          <CardHeader>
            <CardTitle>Where the money went</CardTitle>
            <CardDescription>
              Every supplier invoice, ever. Tag an invoice to an event to see it in that event&apos;s slice;
              &quot;Untagged&quot; is spend with no event yet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {noSpend ? (
              <p className="text-sm text-muted-foreground">No invoices yet.</p>
            ) : (
              <SpendExplorer suppliers={bySupplier} categories={byCategory} />
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Weekly trend (4w)</CardTitle>
              <Button asChild variant="outline" size="sm"><a href="/api/exports/weekly"><Download className="h-3.5 w-3.5" /> CSV</a></Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Week</TableHead>
                    <TableHead className="text-right">Sales</TableHead>
                    <TableHead className="text-right">Food %</TableHead>
                    <TableHead className="text-right">Labor %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weekly.map((w, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{w.label}<div className="text-2xs text-muted-foreground">{w.from} – {w.to}</div></TableCell>
                      <TableCell className="text-right num">{formatMoney(w.netSalesCents)}</TableCell>
                      <TableCell className="text-right num">{formatPercent(w.foodPct)}</TableCell>
                      <TableCell className="text-right num">{formatPercent(w.laborPct)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Supplier spend (30d) · invoices + POs</CardTitle>
              <Button asChild variant="outline" size="sm"><a href="/api/exports/spend"><Download className="h-3.5 w-3.5" /> CSV</a></Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Spend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {spend.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-right num">{r.orderCount}</TableCell>
                      <TableCell className="text-right num">{formatMoney(r.spendCents)}</TableCell>
                    </TableRow>
                  ))}
                  {spend.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">No POs in window.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Labor performance</CardTitle>
              <Button asChild variant="outline" size="sm"><Link href="/labor/report">Open</Link></Button>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Labor %</span><span className="num">{formatPercent(labor.laborPct)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Scheduled hrs</span><span className="num">{labor.totalScheduledHours.toFixed(1)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Actual hrs</span><span className="num">{labor.totalActualHours.toFixed(1)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total cost</span><span className="num">{formatMoney(labor.totalCostCents)}</span></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Inventory variance</CardTitle>
              <Button asChild variant="outline" size="sm"><Link href="/inventory/variance">Open</Link></Button>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {variance ? (
                <>
                  <div className="flex justify-between"><span className="text-muted-foreground">Lines</span><span className="num">{variance.lines.length}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Total $ impact</span><span className="num text-destructive">{formatMoney(variance.totalVarianceCostCents)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Negative lines</span><span className="num">{variance.lines.filter((l) => l.variance < 0).length}</span></div>
                </>
              ) : (
                <span className="text-muted-foreground">No counts yet.</span>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
