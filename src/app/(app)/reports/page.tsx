import Link from "next/link";
import { requireCapability } from "@/lib/scope";
import { dailySummary, weeklyTrend, purchaseSpendByPeriod, supplierSpendByEvent, categorySpendByEvent, pnlByEvent } from "@/modules/reports/queries";
import { getLaborReport } from "@/modules/labor/queries";
import { getVarianceReport } from "@/modules/inventory/queries";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { formatMoney, formatPercent } from "@/lib/money";
import { DeleteReportDayButton } from "./_components/delete-report-day-button";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const scope = await requireCapability("financials");
  const isOwner = scope.role === "OWNER";
  const [daily, weekly, labor, spend, variance, supplierMatrix, categoryMatrix, pnl] = await Promise.all([
    dailySummary(scope.locationId, 14),
    weeklyTrend(scope.locationId, 4),
    getLaborReport(scope.locationId, 14),
    purchaseSpendByPeriod(scope.locationId, 30),
    getVarianceReport(scope.locationId),
    supplierSpendByEvent(scope.locationId),
    categorySpendByEvent(scope.locationId),
    pnlByEvent(scope.businessId, scope.locationId),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Sales · Reports"
        title="Reports"
        description="Daily, weekly, labor, variance, and purchase spend"
        actions={
          <>
            <PrintButton />
            <Button asChild variant="outline" size="sm">
              <Link href="/settings/exports"><Download className="h-3.5 w-3.5" />Download CSV</Link>
            </Button>
          </>
        }
      />
      <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-5 sm:px-6 lg:px-8 grid gap-4">
        {/* P&L — profit and loss per event + overall */}
        <Card className="border-brand/40">
          <CardHeader>
            <CardTitle>Profit &amp; Loss · by event and overall</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Sales minus supplier invoices, labor, expenses and event fees. Event columns use each
              item&apos;s event tag (labor uses the event&apos;s dates); invoices tagged &quot;All events&quot;
              are split evenly across event columns. Overall covers everything, including untagged items.
              Tips are shown for reference — they belong to staff, not profit.
            </p>
          </CardHeader>
          <CardContent className="p-0 report-matrix">
            {pnl.length <= 1 && pnl[0]?.netSalesCents === 0 ? (
              <p className="text-sm text-muted-foreground px-4 pb-4">
                No data yet — import sales and enter invoices to see your P&amp;L.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-40">Line</TableHead>
                    {pnl.map((c) => (
                      <TableHead key={c.key} className={`text-right whitespace-nowrap ${c.key === "overall" ? "font-semibold" : ""}`}>
                        {c.key === "overall" ? (
                          "Overall"
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: c.color ?? "hsl(var(--muted-foreground))" }} />
                            {c.name}
                          </span>
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-muted-foreground">Transactions</TableCell>
                    {pnl.map((c) => (
                      <TableCell key={c.key} className="text-right num text-muted-foreground">{c.txns.toLocaleString()}</TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Net sales</TableCell>
                    {pnl.map((c) => (
                      <TableCell key={c.key} className="text-right num font-medium">{formatMoney(c.netSalesCents)}</TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">Cost of goods</TableCell>
                    {pnl.map((c) => (
                      <TableCell key={c.key} className="text-right num text-muted-foreground">
                        {c.cogsCents ? <>−{formatMoney(c.cogsCents)}</> : "—"}
                      </TableCell>
                    ))}
                  </TableRow>
                  {/* Everything above this line was consumed making what was
                      sold; everything below it is the cost of being open. */}
                  <TableRow>
                    <TableCell className="font-medium">Gross profit</TableCell>
                    {pnl.map((c) => (
                      <TableCell key={c.key} className="text-right num font-medium">
                        {c.netSalesCents
                          ? `${formatMoney(c.grossProfitCents)} (${formatPercent(c.grossMarginPct)})`
                          : "—"}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">Labor</TableCell>
                    {pnl.map((c) => (
                      <TableCell key={c.key} className="text-right num text-muted-foreground">
                        {c.laborCents ? <>−{formatMoney(c.laborCents)}</> : "—"}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">Operating expenses</TableCell>
                    {pnl.map((c) => (
                      <TableCell key={c.key} className="text-right num text-muted-foreground">
                        {c.opexCents ? <>−{formatMoney(c.opexCents)}</> : "—"}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">Event fees</TableCell>
                    {pnl.map((c) => (
                      <TableCell key={c.key} className="text-right num text-muted-foreground">
                        {c.feeCents ? <>−{formatMoney(c.feeCents)}</> : "—"}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow className="bg-muted/30 border-t-2">
                    <TableCell className="font-semibold">Profit</TableCell>
                    {pnl.map((c) => (
                      <TableCell
                        key={c.key}
                        className={`text-right num font-semibold ${c.profitCents < 0 ? "text-destructive" : "text-success"}`}
                      >
                        {formatMoney(c.profitCents, { signed: true })}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow className="bg-muted/30">
                    <TableCell className="text-muted-foreground">Margin</TableCell>
                    {pnl.map((c) => (
                      <TableCell key={c.key} className={`text-right num ${c.profitCents < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                        {c.netSalesCents > 0 ? formatPercent(c.marginPct) : "—"}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground text-xs">Tips (staff, not in profit)</TableCell>
                    {pnl.map((c) => (
                      <TableCell key={c.key} className="text-right num text-xs text-muted-foreground">
                        {c.tipsCents ? formatMoney(c.tipsCents) : "—"}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Daily summary (14d)</CardTitle>
            <Button asChild variant="outline" size="sm"><a href="/api/exports/daily"><Download className="h-3.5 w-3.5" /> CSV</a></Button>
          </CardHeader>
          <CardContent className="p-0 report-matrix">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Net Sales</TableHead>
                  <TableHead className="text-right">Tips</TableHead>
                  <TableHead className="text-right">Guests</TableHead>
                  <TableHead className="text-right">Food $</TableHead>
                  <TableHead className="text-right">Food %</TableHead>
                  <TableHead className="text-right">Labor $</TableHead>
                  <TableHead className="text-right">Labor %</TableHead>
                  <TableHead className="text-right">Cash O/S</TableHead>
                  {isOwner && <TableHead className="w-12 text-right">Delete</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {daily.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.date}</TableCell>
                    <TableCell className="text-right num">{formatMoney(r.netSalesCents)}</TableCell>
                    <TableCell className="text-right num text-muted-foreground">{formatMoney(r.tipsCents)}</TableCell>
                    <TableCell className="text-right num text-muted-foreground">{r.guests}</TableCell>
                    <TableCell className="text-right num">{formatMoney(r.foodCostCents)}</TableCell>
                    <TableCell className={`text-right num ${r.foodPct > 35 ? "text-destructive" : ""}`}>{formatPercent(r.foodPct)}</TableCell>
                    <TableCell className="text-right num">{formatMoney(r.laborCostCents)}</TableCell>
                    <TableCell className={`text-right num ${r.laborPct > 30 ? "text-destructive" : ""}`}>{formatPercent(r.laborPct)}</TableCell>
                    <TableCell className={`text-right num ${r.cashOverShortCents < 0 ? "text-destructive" : r.cashOverShortCents > 0 ? "text-warning" : ""}`}>{formatMoney(r.cashOverShortCents, { signed: true })}</TableCell>
                    {isOwner && (
                      <TableCell className="text-right">
                        {r.hasSales ? (
                          <DeleteReportDayButton iso={r.iso} label={r.date} />
                        ) : (
                          <span className="text-2xs text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Supplier spend × event matrix — where the money went, per event and overall */}
        <Card>
          <CardHeader>
            <CardTitle>Supplier spend by event · all-time</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Every supplier invoice, split by the event it&apos;s tagged to. &quot;All events (shared)&quot; is spend that covers every event (split evenly in the P&amp;L);
              &quot;Untagged&quot; is spend with no event — tag those invoices to make per-event costs exact.
            </p>
          </CardHeader>
          <CardContent className="p-0 report-matrix">
            {supplierMatrix.suppliers.length === 0 ? (
              <p className="text-sm text-muted-foreground px-4 pb-4">No invoices yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-36">Supplier</TableHead>
                    {supplierMatrix.events.map((e) => (
                      <TableHead key={e.id} className="text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: e.color ?? "hsl(var(--muted-foreground))" }} />
                          {e.name}
                        </span>
                      </TableHead>
                    ))}
                    {supplierMatrix.hasShared && <TableHead className="text-right">All events (shared)</TableHead>}
                    {supplierMatrix.hasUntagged && <TableHead className="text-right">Untagged</TableHead>}
                    <TableHead className="text-right font-semibold">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplierMatrix.suppliers.map((s) => (
                    <TableRow key={s.supplierId}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      {supplierMatrix.events.map((e) => (
                        <TableCell key={e.id} className="text-right num text-muted-foreground">
                          {s.byEvent[e.id] ? formatMoney(s.byEvent[e.id]) : "—"}
                        </TableCell>
                      ))}
                      {supplierMatrix.hasShared && (
                        <TableCell className="text-right num text-muted-foreground">
                          {s.sharedCents ? formatMoney(s.sharedCents) : "—"}
                        </TableCell>
                      )}
                      {supplierMatrix.hasUntagged && (
                        <TableCell className="text-right num text-muted-foreground">
                          {s.untaggedCents ? formatMoney(s.untaggedCents) : "—"}
                        </TableCell>
                      )}
                      <TableCell className="text-right num font-semibold">{formatMoney(s.totalCents)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/30">
                    <TableCell className="font-semibold">All suppliers</TableCell>
                    {supplierMatrix.events.map((e) => (
                      <TableCell key={e.id} className="text-right num font-semibold">
                        {formatMoney(supplierMatrix.eventTotals[e.id] ?? 0)}
                      </TableCell>
                    ))}
                    {supplierMatrix.hasShared && (
                      <TableCell className="text-right num font-semibold">{formatMoney(supplierMatrix.grandShared)}</TableCell>
                    )}
                    {supplierMatrix.hasUntagged && (
                      <TableCell className="text-right num font-semibold">{formatMoney(supplierMatrix.grandUntagged)}</TableCell>
                    )}
                    <TableCell className="text-right num font-semibold text-brand-ink">{formatMoney(supplierMatrix.grandTotal)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Invoice spend by category × event matrix */}
        <Card>
          <CardHeader>
            <CardTitle>Spend by category · by event and overall</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Every supplier invoice grouped by what it was for. Set a category on any invoice
              (create or detail page) to see it here.
            </p>
          </CardHeader>
          <CardContent className="p-0 report-matrix">
            {categoryMatrix.categories.length === 0 ? (
              <p className="text-sm text-muted-foreground px-4 pb-4">No invoices yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-40">Category</TableHead>
                    {categoryMatrix.events.map((e) => (
                      <TableHead key={e.id} className="text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: e.color ?? "hsl(var(--muted-foreground))" }} />
                          {e.name}
                        </span>
                      </TableHead>
                    ))}
                    {categoryMatrix.hasShared && <TableHead className="text-right">All events (shared)</TableHead>}
                    {categoryMatrix.hasUntagged && <TableHead className="text-right">Untagged</TableHead>}
                    <TableHead className="text-right font-semibold">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryMatrix.categories.map((c) => (
                    <TableRow key={c.category}>
                      <TableCell className="font-medium">{c.category}</TableCell>
                      {categoryMatrix.events.map((e) => (
                        <TableCell key={e.id} className="text-right num text-muted-foreground">
                          {c.byEvent[e.id] ? formatMoney(c.byEvent[e.id]) : "—"}
                        </TableCell>
                      ))}
                      {categoryMatrix.hasShared && (
                        <TableCell className="text-right num text-muted-foreground">
                          {c.sharedCents ? formatMoney(c.sharedCents) : "—"}
                        </TableCell>
                      )}
                      {categoryMatrix.hasUntagged && (
                        <TableCell className="text-right num text-muted-foreground">
                          {c.untaggedCents ? formatMoney(c.untaggedCents) : "—"}
                        </TableCell>
                      )}
                      <TableCell className="text-right num font-semibold">{formatMoney(c.totalCents)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/30">
                    <TableCell className="font-semibold">All categories</TableCell>
                    {categoryMatrix.events.map((e) => (
                      <TableCell key={e.id} className="text-right num font-semibold">
                        {formatMoney(categoryMatrix.eventTotals[e.id] ?? 0)}
                      </TableCell>
                    ))}
                    {categoryMatrix.hasShared && (
                      <TableCell className="text-right num font-semibold">{formatMoney(categoryMatrix.grandShared)}</TableCell>
                    )}
                    {categoryMatrix.hasUntagged && (
                      <TableCell className="text-right num font-semibold">{formatMoney(categoryMatrix.grandUntagged)}</TableCell>
                    )}
                    <TableCell className="text-right num font-semibold text-brand-ink">{formatMoney(categoryMatrix.grandTotal)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
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
