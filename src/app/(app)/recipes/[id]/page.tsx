import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCapability } from "@/lib/scope";
import { getRecipe, listIngredientsForPicker } from "@/modules/recipes/queries";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatPercent, safeDivide } from "@/lib/money";
import { BomEditor } from "../_components/bom-editor";

export const dynamic = "force-dynamic";

export default async function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireCapability("inventory");
  const [r, ings] = await Promise.all([getRecipe(scope.businessId, id), listIngredientsForPicker(scope.businessId)]);
  if (!r) notFound();
  const pct = safeDivide(r.plateCostCents, r.menuPriceCents) * 100;
  const tone = pct > 35 ? "danger" : pct > 30 ? "warning" : "success";
  return (
    <div>
      <PageHeader
        title={r.name}
        description={`${r.category ?? "—"} · yields ${r.yieldQty} ${r.yieldUnit}`}
        actions={
          <Button asChild variant="outline" size="sm"><Link href="/recipes"><ArrowLeft className="h-3.5 w-3.5" /> All recipes</Link></Button>
        }
      />
      <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-5 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Costing</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Menu price" value={formatMoney(r.menuPriceCents)} />
            <Row label="Plate cost" value={formatMoney(r.plateCostCents)} />
            <Row label="Margin" value={formatMoney(r.menuPriceCents - r.plateCostCents)} />
            <Row label="Food cost %" value={<Badge variant={tone as any}>{formatPercent(pct)}</Badge>} />
            <Row label="Status" value={r.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="muted">Inactive</Badge>} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Bill of materials</CardTitle></CardHeader>
          <CardContent>
            <BomEditor
              recipeId={r.id}
              initial={r.ingredients.map((ri) => ({
                ingredientId: ri.ingredientId,
                name: ri.ingredient.name,
                stockUnit: ri.ingredient.unit,
                unit: ri.unit,
                qty: ri.qty,
                avgCostCents: ri.ingredient.avgCostCents,
              }))}
              catalog={ings.map((i) => ({ id: i.id, name: i.name, unit: i.unit, avgCostCents: i.avgCostCents }))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="num">{value}</span>
    </div>
  );
}
