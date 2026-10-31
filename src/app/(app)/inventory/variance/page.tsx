import Link from "next/link";
import { requireCapability } from "@/lib/scope";
import { getVarianceReport } from "@/modules/inventory/queries";
import { PageHeader } from "@/components/page-header";
import { TableOnDesktop, MobileList, MobileRow, MobileField, MobileEmpty } from "@/components/mobile-list";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatPercent } from "@/lib/money";
import { fmtDateTime } from "@/lib/date";
import { Download } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function VariancePage() {
  const scope = await requireCapability("inventory");
  const report = await getVarianceReport(scope.locationId);
  return (
    <div>
      <PageHeader
        eyebrow="Inventory · Variance"
        title="Inventory variance"
        description={report ? `Last count ${fmtDateTime(report.count.countedAt)}` : "No counts yet"}
        actions={
          <>
            <Button asChild variant="outline" size="sm"><Link href="/inventory/counts">New count</Link></Button>
            {report && (
              <Button asChild variant="outline" size="sm"><a href={`/api/exports/variance`}><Download className="h-3.5 w-3.5" /> CSV</a></Button>
            )}
          </>
        }
      />
      <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-5 sm:px-6 lg:px-8 space-y-4">
        {!report ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No counts recorded yet. Start a weekly count.</CardContent></Card>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Tile label="Items counted" value={String(report.lines.length)} />
              <Tile label="Total variance ($)" value={formatMoney(report.totalVarianceCostCents)} tone="bad" />
              <Tile label="Negative lines" value={String(report.lines.filter((l) => l.variance < 0).length)} tone="bad" />
              <Tile label="Positive lines" value={String(report.lines.filter((l) => l.variance > 0).length)} tone="warn" />
            </div>
            <div className="bento">
              <TableOnDesktop>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingredient</TableHead>
                    <TableHead className="text-right">Theoretical</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead className="text-right">Variance %</TableHead>
                    <TableHead className="text-right">$ Impact</TableHead>
                    <TableHead className="text-right">Severity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.lines.map((l) => {
                    const severity = Math.abs(l.pct) > 5 ? "high" : Math.abs(l.pct) > 2 ? "med" : "low";
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.ingredient}</TableCell>
                        <TableCell className="text-right num text-muted-foreground">{l.theoretical.toFixed(2)} {l.unit}</TableCell>
                        <TableCell className="text-right num">{l.actual.toFixed(2)}</TableCell>
                        <TableCell className={`text-right num ${l.variance < 0 ? "text-destructive" : l.variance > 0 ? "text-warning" : ""}`}>{l.variance > 0 ? "+" : ""}{l.variance.toFixed(2)}</TableCell>
                        <TableCell className={`text-right num ${l.variance < 0 ? "text-destructive" : l.variance > 0 ? "text-warning" : ""}`}>{formatPercent(l.pct)}</TableCell>
                        <TableCell className={`text-right num ${l.varianceCostCents < 0 ? "text-destructive" : ""}`}>{formatMoney(l.varianceCostCents, { signed: true })}</TableCell>
                        <TableCell className="text-right">
                          {severity === "high" ? <Badge variant="danger">High</Badge> : severity === "med" ? <Badge variant="warning">Med</Badge> : <Badge variant="muted">Low</Badge>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableOnDesktop>

            <MobileList>
              {report.lines.map((l) => {
                const severity = Math.abs(l.pct) > 5 ? "high" : Math.abs(l.pct) > 2 ? "med" : "low";
                return (
                  <MobileRow
                    key={l.id}
                    title={l.ingredient}
                    meta={
                      <span className={l.varianceCostCents < 0 ? "text-destructive" : undefined}>
                        {formatMoney(l.varianceCostCents, { signed: true })}
                      </span>
                    }
                    badges={
                      severity === "high" ? <Badge variant="danger">High</Badge>
                        : severity === "med" ? <Badge variant="warning">Med</Badge>
                        : <Badge variant="muted">Low</Badge>
                    }
                  >
                    <MobileField label={`Theoretical (${l.unit})`} value={l.theoretical.toFixed(2)} />
                    <MobileField label="Actual" value={l.actual.toFixed(2)} />
                    <MobileField
                      label="Variance"
                      value={`${l.variance > 0 ? "+" : ""}${l.variance.toFixed(2)}`}
                    />
                    <MobileField label="Variance %" value={formatPercent(l.pct)} />
                  </MobileRow>
                );
              })}
              {report.lines.length === 0 && <MobileEmpty>No variance lines.</MobileEmpty>}
            </MobileList>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const t = tone === "bad" ? "text-destructive" : tone === "warn" ? "text-warning" : tone === "good" ? "text-success" : "";
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-xl font-semibold num ${t}`}>{value}</div>
    </div>
  );
}
