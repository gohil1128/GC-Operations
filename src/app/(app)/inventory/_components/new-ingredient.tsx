"use client";
import * as React from "react";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UnitSelect } from "@/components/ui/unit-select";
import { CategorySelect } from "@/components/ui/category-select";
import { INGREDIENT_CATEGORIES } from "@/lib/gc-categories";
import { useRouter, useSearchParams } from "next/navigation";
import { createIngredientAction } from "@/modules/inventory/actions";
import { toast } from "@/components/ui/use-toast";

export function NewIngredientButton() {
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const router = useRouter();
  /*
    Opened by ?new=1, which is where /inventory/new lands. The parameter is
    dropped as soon as it has been read so that closing the dialog and
    reloading, or sharing the address, does not reopen it.
  */
  const params = useSearchParams();
  React.useEffect(() => {
    if (params.get("new") !== "1") return;
    setOpen(true);
    router.replace("/inventory", { scroll: false });
  }, [params, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-3.5 w-3.5" /> New ingredient</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New ingredient</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            start(async () => {
              try {
                await createIngredientAction(form);
                toast({ title: "Ingredient created" });
                setOpen(false);
                router.refresh();
              } catch (err: any) {
                toast({ title: "Could not create ingredient", description: String(err?.message ?? err), variant: "destructive" });
              }
            });
          }}
          className="grid gap-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="category">Category</Label>
              <CategorySelect id="category" name="category" options={INGREDIENT_CATEGORIES} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" name="sku" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="unit">Stock unit</Label>
              <UnitSelect id="unit" name="unit" defaultValue="g" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="lastCostDollars">Last cost ($/unit)</Label>
              <Input id="lastCostDollars" name="lastCostDollars" type="number" step="0.01" min="0" required />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="parLevel">Par level</Label>
              <Input id="parLevel" name="parLevel" type="number" step="0.01" min="0" defaultValue={0} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="reorderPoint">Reorder point</Label>
              <Input id="reorderPoint" name="reorderPoint" type="number" step="0.01" min="0" defaultValue={0} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="reorderQty">Reorder qty</Label>
              <Input id="reorderQty" name="reorderQty" type="number" step="0.01" min="0" defaultValue={0} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
