"use client";
import * as React from "react";
import { formatMoney } from "@/lib/money";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle, Loader2, Tag, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import { setItemCategoryAction, deleteItemSalesAction, setItemRecipeAction } from "@/modules/items/actions";
import { categoriesInUse, categoryStyle } from "@/modules/items/categories";

type Item = {
  itemName: string;
  category: string; // normalized
  qty: number;
  netSalesDollars: number;
  dayCount: number;
  /** The recipe this item is made from, if it has been pointed at one. */
  recipeId: string | null;
};

export type RecipeOption = { id: string; name: string; unitCostCents: number };

const NO_RECIPE = "__none__";

// Shared formatter so thousands separators match the rest of the app.
const money = (n: number) => formatMoney(Math.round(n * 100));

export function ItemsManager({ items, recipes }: { items: Item[]; recipes: RecipeOption[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const [confirm, setConfirm] = React.useState<{ itemName: string } | null>(null);
  // Optimistic local category state so the dropdown updates immediately.
  const [cats, setCats] = React.useState<Record<string, string>>(
    () => Object.fromEntries(items.map((i) => [i.itemName, i.category]))
  );
  /*
    Every category in play: the ones on the business's items, plus whatever has
    been picked in this session, plus the two universal buckets. Recomputed as
    `cats` changes so a category typed on one row is immediately offered on the
    next.
  */
  const categoryOptions = React.useMemo(
    () => categoriesInUse([...items.map((i) => i.category), ...Object.values(cats)]),
    [items, cats],
  );

  const [links, setLinks] = React.useState<Record<string, string>>(
    () => Object.fromEntries(items.map((i) => [i.itemName, i.recipeId ?? NO_RECIPE]))
  );

  React.useEffect(() => {
    setCats(Object.fromEntries(items.map((i) => [i.itemName, i.category])));
    setLinks(Object.fromEntries(items.map((i) => [i.itemName, i.recipeId ?? NO_RECIPE])));
  }, [items]);

  const onRecipe = (itemName: string, next: string) => {
    setLinks((l) => ({ ...l, [itemName]: next }));
    setBusy(`rec:${itemName}`);
    (async () => {
      try {
        await setItemRecipeAction(itemName, next === NO_RECIPE ? null : next);
        const name = recipes.find((r) => r.id === next)?.name;
        toast({
          title: next === NO_RECIPE ? "Recipe unlinked" : "Recipe linked",
          description: next === NO_RECIPE ? itemName : `${itemName} → ${name}`,
        });
        router.refresh();
      } catch (err: any) {
        toast({ title: "Failed", description: String(err?.message ?? err), variant: "destructive" });
      } finally {
        setBusy(null);
      }
    })();
  };

  const onCategory = (itemName: string, next: string) => {
    setCats((c) => ({ ...c, [itemName]: next }));
    setBusy(`cat:${itemName}`);
    (async () => {
      try {
        await setItemCategoryAction(itemName, next);
        toast({ title: "Category updated", description: `${itemName} → ${next}` });
        router.refresh();
      } catch (err: any) {
        toast({ title: "Failed", description: String(err?.message ?? err), variant: "destructive" });
      } finally {
        setBusy(null);
      }
    })();
  };

  const onDelete = (itemName: string) => {
    setBusy(`del:${itemName}`);
    (async () => {
      try {
        const res = await deleteItemSalesAction(itemName);
        toast({ title: "Item sales deleted", description: `${itemName} · ${res.rowsDeleted} row(s) removed` });
        setConfirm(null);
        router.refresh();
      } catch (err: any) {
        toast({ title: "Delete failed", description: String(err?.message ?? err), variant: "destructive" });
      } finally {
        setBusy(null);
      }
    })();
  };

  const filtered = q.trim()
    ? items.filter((i) => i.itemName.toLowerCase().includes(q.trim().toLowerCase()))
    : items;

  if (items.length === 0) {
    return (
      <div className="rounded-xl border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
        <Tag className="mx-auto mb-2 h-7 w-7 text-muted-foreground/40" />
        No item-level sales yet. Upload an Item Sales or Item Summary CSV above first.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-xs">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-7 h-8" placeholder="Search items…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="rounded-xl border overflow-hidden lg:max-h-[min(60vh,460px)] lg:overflow-y-auto lg:overscroll-contain">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="w-44">Category</TableHead>
              <TableHead className="w-52">Recipe</TableHead>
              <TableHead className="text-right">Units</TableHead>
              <TableHead className="text-right">Net</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((i) => {
              const cur = cats[i.itemName] ?? i.category;
              const s = categoryStyle(cur);
              return (
                <TableRow key={i.itemName}>
                  <TableCell className="font-medium">
                    {i.itemName}
                    <div className="text-2xs text-muted-foreground">{i.dayCount} day{i.dayCount === 1 ? "" : "s"}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${s.dot}`} />
                      <Select value={cur} onValueChange={(v) => onCategory(i.itemName, v)} disabled={busy === `cat:${i.itemName}`}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {/* The categories THIS business uses, not a preset
                              menu. The list used to be Hot Chai / Cold Chais /
                              Food, so a bakery could only file a croissant
                              under somebody else's drinks. */}
                          {categoryOptions.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                          {!categoryOptions.includes(cur) && (
                            <SelectItem value={cur}>{cur}</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      {busy === `cat:${i.itemName}` && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                    </div>
                  </TableCell>
                  {/* Pointing an item at its recipe is what makes a margin
                      possible: Square sends a name and a price, never a cost. */}
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Select
                        value={links[i.itemName] ?? NO_RECIPE}
                        onValueChange={(v) => onRecipe(i.itemName, v)}
                        disabled={busy === `rec:${i.itemName}` || recipes.length === 0}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder={recipes.length === 0 ? "No recipes yet" : "Not costed"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_RECIPE}>Not costed</SelectItem>
                          {recipes.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.name}
                              {r.unitCostCents > 0 && ` · ${formatMoney(r.unitCostCents)}/unit`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {busy === `rec:${i.itemName}` && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                    </div>
                  </TableCell>
                  <TableCell className="text-right num text-muted-foreground">{i.qty.toLocaleString()}</TableCell>
                  <TableCell className="text-right num">{money(i.netSalesDollars)}</TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={busy !== null}
                      onClick={() => setConfirm({ itemName: i.itemName })}
                      aria-label={`Delete ${i.itemName} sales`}
                    >
                      {busy === `del:${i.itemName}` ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">No items match.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Delete &quot;{confirm?.itemName}&quot; sales?
            </DialogTitle>
            <DialogDescription>
              This removes every imported sales row for this item across all dates at this location.
              Day-level sales totals are not changed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirm(null)} disabled={busy !== null}>Cancel</Button>
            <Button variant="destructive" onClick={() => confirm && onDelete(confirm.itemName)} disabled={busy !== null}>
              {busy !== null ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
