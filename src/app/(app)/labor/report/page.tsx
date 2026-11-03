import { requireCapability } from "@/lib/scope";
import { getLaborReport } from "@/modules/labor/queries";
import { PageHeader } from "@/components/page-header";
import { TableOnDesktop, MobileList, MobileRow, MobileField, MobileEmpty } from "@/components/mobile-list";
import { KpiCard } from "@/components/charts/kpi-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney, formatPercent } from "@/lib/money";
import { fmtDate } from "@/lib/date";
import { Download } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function LaborReportPage() {
  const scope = await requireCapability("labor");
  const r = await getLaborReport(scope.locationId, 14);
  const laborTarget = 30;
  const tone = r.laborPct > laborTarget ? "bad" : r.laborPct > laborTarget - 2 ? "warn" : "good";
  return (
    <div>
      <PageHeader
        eyebrow="Labor · Report"
        title="Labor performance"
        description={`${fmtDate(r.period.from)} – ${fmtDate(r.period.to)} · ${r.period.days} days`}
        actions={<Button asChild variant="outline" size="sm"><a href="/api/exports/labor"><Download className="h-3.5 w-3.5" /> CSV</a></Button>}
      />
      <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-5 sm:px-6 lg:px-8 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Net Sales" value={formatMoney(r.netSalesCents)} />
          <KpiCard label="Labor Cost" value={formatMoney(r.totalCostCents)} />
          <KpiCard label="Labor %" value={formatPercent(r.laborPct)} tone={tone} delta={`Target ${laborTarget}%`} />
          <KpiCard label="Scheduled hrs" value={r.totalScheduledHours.toFixed(1)} delta={`Actual ${r.totalActualHours.toFixed(1)}`} />
        </div>

        <div className="bento">
          <TableOnDesktop>
              <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Position</TableHead>
                <TableHead className="text-right">Wage</TableHead>
                <TableHead className="text-right">Scheduled hrs</TableHead>
                <TableHead className="text-right">Actual hrs</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.byEmployee.map((e, i) => {
                const variance = e.actualMin - e.scheduledMin;
                const big = Math.abs(variance) > 60;
                return (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell className="text-muted-foreground">{e.position}</TableCell>
                    <TableCell className="text-right num">{formatMoney(e.rate)}/hr</TableCell>
                    <TableCell className="text-right num">{(e.scheduledMin / 60).toFixed(1)}</TableCell>
                    <TableCell className="text-right num">{(e.actualMin / 60).toFixed(1)}</TableCell>
                    <TableCell className={`text-right num ${big ? "text-warning" : ""}`}>{variance > 0 ? "+" : ""}{(variance / 60).toFixed(1)}</TableCell>
                    <TableCell className="text-right num">{formatMoney(e.costCents)}</TableCell>
                  </TableRow>
                );
              })}
              {r.byEmployee.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">No labor recorded in this period.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
            </TableOnDesktop>

            <MobileList>
              {r.byEmployee.map((e, i) => {
                const variance = e.actualMin - e.scheduledMin;
                const big = Math.abs(variance) > 60;
                return (
                  <MobileRow
                    key={i}
                    title={e.name}
                    subtitle={e.position}
                    meta={formatMoney(e.costCents)}
                  >
                    <MobileField label="Scheduled" value={`${(e.scheduledMin / 60).toFixed(1)} h`} />
                    <MobileField label="Actual" value={`${(e.actualMin / 60).toFixed(1)} h`} />
                    <MobileField
                      label="Variance"
                      value={
                        <span className={big ? "text-warning" : undefined}>
                          {variance > 0 ? "+" : ""}{(variance / 60).toFixed(1)} h
                        </span>
                      }
                    />
                    <MobileField label="Wage" value={`${formatMoney(e.rate)}/hr`} />
                  </MobileRow>
                );
              })}
              {r.byEmployee.length === 0 && <MobileEmpty>No labor recorded in this period.</MobileEmpty>}
            </MobileList>
        </div>
      </div>
    </div>
  );
}
