import { requireCapability } from "@/lib/scope";
import { getReorderSuggestions, listSuppliers } from "@/modules/purchasing/queries";
import { PageHeader } from "@/components/page-header";
import { ReorderBuilder } from "./_components/reorder-builder";

export const dynamic = "force-dynamic";

export default async function NewPoPage() {
  const scope = await requireCapability("purchasing");
  const [groups, suppliers] = await Promise.all([
    getReorderSuggestions(scope.businessId),
    listSuppliers(scope.businessId),
  ]);
  return (
    <div>
      <PageHeader title="New purchase order" description="Reorder suggestions are grouped by supplier" />
      <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-5 sm:px-6 lg:px-8">
        <ReorderBuilder
          groups={groups.map((g) => ({
            supplier: g.supplier ? { id: g.supplier.id, name: g.supplier.name, leadTimeDays: g.supplier.leadTimeDays } : null,
            items: g.items.map((s) => ({
              ingredientId: s.ingredient.id,
              name: s.ingredient.name,
              unit: s.ingredient.unit,
              onHand: s.ingredient.onHand,
              parLevel: s.ingredient.parLevel,
              reorderPoint: s.ingredient.reorderPoint,
              suggested: s.suggested,
              lastCostCents: s.ingredient.lastCostCents,
            })),
          }))}
          allSuppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        />
      </div>
    </div>
  );
}
