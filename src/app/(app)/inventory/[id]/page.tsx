import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCapability } from "@/lib/scope";
import { getIngredient } from "@/modules/inventory/queries";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { fmtDateTime } from "@/lib/date";
import { WasteForm } from "../_components/waste-form";
import { EditIngredientButton } from "../_components/edit-ingredient";

export const dynamic = "force-dynamic";

export default async function IngredientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireCapability("inventory");
  const ing = await getIngredient(scope.businessId, id);
  if (!ing) notFound();
  const low = ing.onHand <= ing.reorderPoint && ing.reorderPoint > 0;
  return (
    <div>
      <PageHeader
        title={ing.name}
        description={`${ing.category ?? "—"} · ${ing.unit}`}
        actions={
          <>
            <Button asChild variant="outline" size="sm"><Link href="/inventory"><ArrowLeft className="h-3.5 w-3.5" /> All ingredients</Link></Button>
            <EditIngredientButton
              variant="button"
              ingredient={{
                id: ing.id,
                name: ing.name,
                category: ing.category,
                sku: ing.sku,
                unit: ing.unit,
                onHand: ing.onHand,
                parLevel: ing.parLevel,
                reorderPoint: ing.reorderPoint,
                reorderQty: ing.reorderQty,
                lastCostDollars: ing.lastCostCents / 100,
              }}
            />
          </>
        }
      />
      <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-5 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="On hand" value={`${ing.onHand.toFixed(2)} ${ing.unit}`} tone={low ? "bad" : "neutral"} />
            <Row label="Par level" value={`${ing.parLevel.toFixed(2)} ${ing.unit}`} />
            <Row label="Reorder point" value={`${ing.reorderPoint.toFixed(2)} ${ing.unit}`} />
            <Row label="Reorder qty" value={`${ing.reorderQty.toFixed(2)} ${ing.unit}`} />
            <Row label="Last cost" value={formatMoney(ing.lastCostCents) + ` / ${ing.unit}`} />
            <Row label="Avg cost" value={formatMoney(ing.avgCostCents) + ` / ${ing.unit}`} />
            <Row label="Supplier" value={ing.supplier?.name ?? "—"} />
            <Row label="SKU" value={ing.sku ?? "—"} />
            {low && <Badge variant="danger">Below reorder point</Badge>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Record waste / adjustment</CardTitle></CardHeader>
          <CardContent>
            <WasteForm ingredientId={ing.id} />
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>Recent movements</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ing.movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-muted-foreground">{fmtDateTime(m.occurredAt)}</TableCell>
                    <TableCell><Badge variant={badgeVariant(m.type)}>{m.type.replace("_", " ")}</Badge></TableCell>
                    <TableCell className={`text-right num ${m.qty < 0 ? "text-destructive" : "text-success"}`}>{m.qty > 0 ? "+" : ""}{m.qty.toFixed(2)} {m.unit}</TableCell>
                    <TableCell className="text-right num">{formatMoney(m.unitCostCents)}</TableCell>
                    <TableCell className="text-muted-foreground">{m.sourceType ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{m.note ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {ing.movements.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">No movements yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "neutral" | "bad" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`num ${tone === "bad" ? "text-destructive font-medium" : ""}`}>{value}</span>
    </div>
  );
}

function badgeVariant(type: string): "default" | "muted" | "danger" | "warning" | "success" {
  switch (type) {
    case "PURCHASE": return "success";
    case "USAGE": return "muted";
    case "WASTE": return "danger";
    case "ADJUSTMENT": return "warning";
    case "COUNT_RECONCILE": return "default";
    default: return "muted";
  }
}
