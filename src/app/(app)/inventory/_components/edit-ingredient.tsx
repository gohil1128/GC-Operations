"use client";
import * as React from "react";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UnitSelect } from "@/components/ui/unit-select";
import { CategorySelect } from "@/components/ui/category-select";
import { INGREDIENT_CATEGORIES } from "@/lib/gc-categories";
import { updateIngredientAction } from "@/modules/inventory/actions";
import { toast } from "@/components/ui/use-toast";

export type EditableIngredient = {
  id: string;
  name: string;
  category: string | null;
  sku: string | null;
  unit: string;
  onHand: number;
  parLevel: number;
  reorderPoint: number;
  reorderQty: number;
  lastCostDollars: number;
};

export function EditIngredientButton({
  ingredient,
  variant = "icon",
}: {
  ingredient: EditableIngredient;
  variant?: "icon" | "button";
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "icon" ? (
          <Button size="icon-sm" variant="ghost" aria-label={`Edit ${ingredient.name}`}>
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        ) : (
          <Button size="sm" variant="outline"><Pencil className="h-3.5 w-3.5" /> Edit</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {ingredient.name}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            start(async () => {
              try {
                await updateIngredientAction(ingredient.id, form);
                toast({ title: "Ingredient updated" });
                setOpen(false);
                router.refresh();
              } catch (err: any) {
                toast({ title: "Update failed", description: String(err?.message ?? err), variant: "destructive" });
              }
            });
          }}
          className="grid gap-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor={`ei-name-${ingredient.id}`}>Name</Label>
              <Input id={`ei-name-${ingredient.id}`} name="name" required defaultValue={ingredient.name} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`ei-cat-${ingredient.id}`}>Category</Label>
              <CategorySelect
                id={`ei-cat-${ingredient.id}`}
                name="category"
                options={INGREDIENT_CATEGORIES}
                defaultValue={ingredient.category}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor={`ei-sku-${ingredient.id}`}>SKU</Label>
              <Input id={`ei-sku-${ingredient.id}`} name="sku" defaultValue={ingredient.sku ?? ""} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`ei-unit-${ingredient.id}`}>Stock unit</Label>
              <UnitSelect id={`ei-unit-${ingredient.id}`} name="unit" defaultValue={ingredient.unit} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`ei-cost-${ingredient.id}`}>Last cost ($/unit)</Label>
              <Input id={`ei-cost-${ingredient.id}`} name="lastCostDollars" type="number" step="0.01" min="0" required defaultValue={ingredient.lastCostDollars.toFixed(2)} />
            </div>
          </div>

          <div className="grid gap-1.5 rounded-lg border bg-muted/30 p-3">
            <Label htmlFor={`ei-onhand-${ingredient.id}`}>Volume on hand</Label>
            <Input
              id={`ei-onhand-${ingredient.id}`}
              name="onHand"
              type="number"
              step="0.001"
              min="0"
              defaultValue={ingredient.onHand}
            />
            <span className="text-2xs text-muted-foreground">
              How much you actually have right now, in the stock unit above. Changing this records
              an adjustment in the movement history.
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor={`ei-par-${ingredient.id}`}>Par level</Label>
              <Input id={`ei-par-${ingredient.id}`} name="parLevel" type="number" step="0.01" min="0" defaultValue={ingredient.parLevel} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`ei-rp-${ingredient.id}`}>Reorder point</Label>
              <Input id={`ei-rp-${ingredient.id}`} name="reorderPoint" type="number" step="0.01" min="0" defaultValue={ingredient.reorderPoint} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`ei-rq-${ingredient.id}`}>Reorder qty</Label>
              <Input id={`ei-rq-${ingredient.id}`} name="reorderQty" type="number" step="0.01" min="0" defaultValue={ingredient.reorderQty} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save changes"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
