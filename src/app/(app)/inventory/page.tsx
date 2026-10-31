import Link from "next/link";
import { Plus, FileBarChart, ClipboardList } from "lucide-react";
import { requireCapability } from "@/lib/scope";
import { listIngredients } from "@/modules/inventory/queries";
import { PageHeader } from "@/components/page-header";
import { TableOnDesktop, MobileList, MobileRow, MobileField, MobileEmpty } from "@/components/mobile-list";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/money";
import { NewIngredientButton } from "./_components/new-ingredient";
import { EditIngredientButton } from "./_components/edit-ingredient";
import { DeleteButton } from "@/components/delete-button";
import { deleteIngredientAction } from "@/modules/inventory/actions";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const scope = await requireCapability("inventory");
  const items = await listIngredients(scope.businessId);
  const lowCount = items.filter((i) => i.onHand <= i.reorderPoint && i.reorderPoint > 0).length;
  /*
    Ingredients with no reorder point set.

    A zero means "do not watch this", which is right — but it also means the
    "N below reorder point" figure in the header is silently counting nothing.
    Reading "0 below reorder point" when not one ingredient has a level set
    says everything is fine, when in fact nothing is being watched at all. The
    two are opposite conclusions from the same figure, so the header has to
    say which one it is.
  */
  const unwatched = items.filter((i) => i.reorderPoint <= 0).length;
  return (
    <div>
      <PageHeader
        eyebrow="Inventory · Ingredients"
        title="Inventory"
        description={
          unwatched === items.length && items.length > 0
            ? `${items.length} ingredients · no reorder points set, so nothing is being watched`
            : `${items.length} ingredients · ${lowCount} below reorder point${
                unwatched > 0 ? ` · ${unwatched} with no level set` : ""
              }`
        }
        actions={
          <>
            <Button asChild variant="outline" size="sm"><Link href="/inventory/counts"><ClipboardList className="h-3.5 w-3.5" /> Counts</Link></Button>
            <Button asChild variant="outline" size="sm"><Link href="/inventory/variance"><FileBarChart className="h-3.5 w-3.5" /> Variance</Link></Button>
            <NewIngredientButton />
          </>
        }
      />
      <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-5 sm:px-6 lg:px-8">
        <div className="bento">
          <TableOnDesktop>
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">On Hand</TableHead>
                <TableHead className="text-right">Par</TableHead>
                <TableHead className="text-right">Reorder Pt</TableHead>
                <TableHead className="text-right">Last Cost</TableHead>
                <TableHead className="text-right">Status</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => {
                const low = i.onHand <= i.reorderPoint && i.reorderPoint > 0;
                return (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">
                      <Link href={`/inventory/${i.id}`} className="hover:underline">{i.name}</Link>
                      {i.sku && <span className="text-2xs text-muted-foreground ml-2">{i.sku}</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{i.category ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{i.supplier?.name ?? "—"}</TableCell>
                    <TableCell className={`text-right num ${low ? "text-destructive font-medium" : ""}`}>
                      {i.onHand.toFixed(2)} {i.unit}
                    </TableCell>
                    <TableCell className="text-right num text-muted-foreground">{i.parLevel.toFixed(2)}</TableCell>
                    <TableCell className="text-right num text-muted-foreground">{i.reorderPoint.toFixed(2)}</TableCell>
                    <TableCell className="text-right num">{formatMoney(i.lastCostCents)}</TableCell>
                    <TableCell className="text-right">
                      {low ? <Badge variant="danger">Low</Badge> : <Badge variant="muted">OK</Badge>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-0.5">
                        <EditIngredientButton
                          ingredient={{
                            id: i.id,
                            name: i.name,
                            category: i.category,
                            sku: i.sku,
                            unit: i.unit,
                            onHand: i.onHand,
                            parLevel: i.parLevel,
                            reorderPoint: i.reorderPoint,
                            reorderQty: i.reorderQty,
                            lastCostDollars: i.lastCostCents / 100,
                          }}
                        />
                        <DeleteButton
                          action={deleteIngredientAction.bind(null, i.id)}
                          itemLabel="ingredient"
                          itemName={i.name}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">No ingredients yet. Click &quot;New ingredient&quot;.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </TableOnDesktop>

          <MobileList>
            {items.map((i) => {
              const low = i.onHand <= i.reorderPoint && i.reorderPoint > 0;
              return (
                <MobileRow
                  key={i.id}
                  title={
                    <Link href={`/inventory/${i.id}`} className="hover:underline">{i.name}</Link>
                  }
                  subtitle={[i.category, i.supplier?.name].filter(Boolean).join(" · ") || undefined}
                  meta={
                    <span className={low ? "text-destructive" : undefined}>
                      {i.onHand.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">{i.unit}</span>
                    </span>
                  }
                  badges={
                    <>
                      {low ? <Badge variant="danger">Low</Badge> : <Badge variant="muted">OK</Badge>}
                      {i.sku && <Badge variant="muted">{i.sku}</Badge>}
                      <span className="ml-auto flex items-center gap-0.5">
                        <EditIngredientButton
                          ingredient={{
                            id: i.id,
                            name: i.name,
                            category: i.category,
                            sku: i.sku,
                            unit: i.unit,
                            onHand: i.onHand,
                            parLevel: i.parLevel,
                            reorderPoint: i.reorderPoint,
                            reorderQty: i.reorderQty,
                            lastCostDollars: i.lastCostCents / 100,
                          }}
                        />
                        <DeleteButton
                          action={deleteIngredientAction.bind(null, i.id)}
                          itemLabel="ingredient"
                          itemName={i.name}
                        />
                      </span>
                    </>
                  }
                >
                  <MobileField label="Par" value={i.parLevel.toFixed(2)} />
                  <MobileField label="Reorder pt" value={i.reorderPoint.toFixed(2)} />
                  <MobileField label="Last cost" value={formatMoney(i.lastCostCents)} />
                </MobileRow>
              );
            })}
            {items.length === 0 && <MobileEmpty>No ingredients yet.</MobileEmpty>}
          </MobileList>
        </div>
      </div>
    </div>
  );
}
