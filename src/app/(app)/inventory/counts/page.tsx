import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { requireCapability } from "@/lib/scope";
import { listIngredients, listCounts } from "@/modules/inventory/queries";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDateTime } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { CountEntryGrid } from "./_components/count-entry-grid";

export const dynamic = "force-dynamic";

export default async function CountsPage() {
  const scope = await requireCapability("inventoryCount");
  const [ingredients, counts] = await Promise.all([listIngredients(scope.businessId), listCounts(scope.locationId)]);
  return (
    <div>
      <PageHeader
        eyebrow="Inventory · Counts"
        title="Inventory counts"
        description="Enter physical counts to calculate variance"
        actions={<Button asChild variant="outline" size="sm"><Link href="/inventory/variance"><ClipboardList className="h-3.5 w-3.5" /> Variance report</Link></Button>}
      />
      <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-5 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>New count</CardTitle></CardHeader>
          <CardContent>
            <CountEntryGrid ingredients={ingredients.map((i) => ({ id: i.id, name: i.name, unit: i.unit, onHand: i.onHand }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recent counts</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Lines</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {counts.map((c) => {
                  const totalVarCents = c.lines.reduce((a, l) => a + Math.abs(l.varianceCostCents), 0);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="text-muted-foreground">{fmtDateTime(c.countedAt)}</TableCell>
                      <TableCell className="num">{c.lines.length}</TableCell>
                      <TableCell className="text-right num text-destructive">{formatMoney(totalVarCents)}</TableCell>
                    </TableRow>
                  );
                })}
                {counts.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">No counts yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
