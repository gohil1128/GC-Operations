import Link from "next/link";
import { requireCapability } from "@/lib/scope";
import { listRecipes } from "@/modules/recipes/queries";
import { PageHeader } from "@/components/page-header";
import { TableOnDesktop, MobileList, MobileRow, MobileField, MobileEmpty } from "@/components/mobile-list";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatPercent, safeDivide } from "@/lib/money";
import { NewRecipeButton } from "./_components/new-recipe";
import { DeleteButton } from "@/components/delete-button";
import { deleteRecipeAction } from "@/modules/recipes/actions";

export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  const scope = await requireCapability("inventory");
  const recipes = await listRecipes(scope.businessId);
  return (
    <div>
      <PageHeader eyebrow="Inventory · Recipes" title="Recipes" description={`${recipes.length} menu items`} actions={<NewRecipeButton />} />
      <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-5 sm:px-6 lg:px-8">
        <div className="bento">
          <TableOnDesktop>
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Menu Price</TableHead>
                <TableHead className="text-right">Plate Cost</TableHead>
                <TableHead className="text-right">Food Cost %</TableHead>
                <TableHead className="text-right">Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {recipes.map((r) => {
                const pct = safeDivide(r.plateCostCents, r.menuPriceCents) * 100;
                const tone = pct > 35 ? "danger" : pct > 30 ? "warning" : "success";
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <Link href={`/recipes/${r.id}`} className="hover:underline">{r.name}</Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.category ?? "—"}</TableCell>
                    <TableCell className="text-right num">{formatMoney(r.menuPriceCents)}</TableCell>
                    <TableCell className="text-right num">{formatMoney(r.plateCostCents)}</TableCell>
                    <TableCell className="text-right num">
                      <Badge variant={tone as any}>{formatPercent(pct)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{r.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="muted">Inactive</Badge>}</TableCell>
                    <TableCell>
                      <DeleteButton action={deleteRecipeAction.bind(null, r.id)} itemLabel="recipe" itemName={r.name} />
                    </TableCell>
                  </TableRow>
                );
              })}
              {recipes.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">No recipes yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          </TableOnDesktop>

          <MobileList>
            {recipes.map((r) => {
              const pct = safeDivide(r.plateCostCents, r.menuPriceCents) * 100;
              const tone = pct > 35 ? "danger" : pct > 30 ? "warning" : "success";
              return (
                <MobileRow
                  key={r.id}
                  title={<Link href={`/recipes/${r.id}`} className="hover:underline">{r.name}</Link>}
                  subtitle={r.category ?? undefined}
                  meta={formatMoney(r.menuPriceCents)}
                  badges={
                    <>
                      <Badge variant={tone as any}>{formatPercent(pct)} food cost</Badge>
                      {r.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="muted">Inactive</Badge>}
                      <span className="ml-auto">
                        <DeleteButton action={deleteRecipeAction.bind(null, r.id)} itemLabel="recipe" itemName={r.name} />
                      </span>
                    </>
                  }
                >
                  <MobileField label="Plate cost" value={formatMoney(r.plateCostCents)} />
                  <MobileField label="Menu price" value={formatMoney(r.menuPriceCents)} />
                </MobileRow>
              );
            })}
            {recipes.length === 0 && <MobileEmpty>No recipes yet.</MobileEmpty>}
          </MobileList>
        </div>
      </div>
    </div>
  );
}
