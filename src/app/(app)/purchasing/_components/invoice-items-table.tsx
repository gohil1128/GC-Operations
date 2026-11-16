"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Search, Sparkles } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UnitSelect } from "@/components/ui/unit-select";
import { CategorySelect } from "@/components/ui/category-select";
import { INGREDIENT_CATEGORIES } from "@/lib/gc-categories";
import { addInvoiceItemAction, removeInvoiceItemAction } from "@/modules/invoices/actions";
import { quickCreateIngredientAction } from "@/modules/inventory/actions";
import { toast } from "@/components/ui/use-toast";

type Item = {
  id: string;
  ingredientName: string;
  category: string | null;
  qty: number;
  unit: string;
  unitCostDollars: number;
  lineTotalDollars: number;
};

type Ingredient = {
  id: string; name: string; sku: string | null; unit: string;
  category: string | null; lastCostCents: number; supplierId: string | null;
};

const fmt = (n: number) => `$${n.toFixed(2)}`;

export function InvoiceItemsTable({ invoiceId, supplierId, items, readOnly }: { invoiceId: string; supplierId?: string | null; items: Item[]; readOnly: boolean }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<Ingredient[]>([]);
  const [picked, setPicked] = React.useState<Ingredient | null>(null);
  const [qty, setQty] = React.useState("1");
  const [cost, setCost] = React.useState("0");

  const [createOpen, setCreateOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newUnit, setNewUnit] = React.useState("ea");
  const [newCategory, setNewCategory] = React.useState("");
  const [newCost, setNewCost] = React.useState("");

  const openCreate = () => {
    setNewName(q.trim());
    setNewUnit("ea");
    setNewCategory("");
    setNewCost("");
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    if (!newName.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    if (!newUnit.trim()) { toast({ title: "Unit is required", variant: "destructive" }); return; }
    setCreating(true);
    try {
      const created = await quickCreateIngredientAction({
        name: newName,
        unit: newUnit,
        category: newCategory || null,
        lastCostDollars: Number(newCost) || 0,
        // Link the new ingredient to this invoice's supplier so reorder
        // suggestions and supplier spend reports pick it up automatically.
        supplierId: supplierId ?? null,
      });
      toast({ title: `${created.name} created`, description: "Auto-filled below — adjust qty and add it." });
      setCreateOpen(false);
      setPicked(created);
      setQ(created.name);
      setCost((created.lastCostCents / 100).toFixed(2));
      setQty("1");
    } catch (err: any) {
      toast({ title: "Could not create", description: String(err?.message ?? err), variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  React.useEffect(() => {
    const timer = setTimeout(() => {
      fetch(`/api/purchasing/invoices/search-ingredients?q=${encodeURIComponent(q)}`)
        .then((r) => r.ok ? r.json() : { ingredients: [] })
        .then((d) => setResults(d.ingredients ?? []))
        .catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(timer);
  }, [q]);

  const pick = (ing: Ingredient) => {
    setPicked(ing);
    setCost((ing.lastCostCents / 100).toFixed(2));
  };

  const add = () => {
    if (!picked) return;
    const qn = Number(qty); const cn = Number(cost);
    if (!isFinite(qn) || qn <= 0) { toast({ title: "Quantity must be > 0", variant: "destructive" }); return; }
    start(async () => {
      try {
        await addInvoiceItemAction(invoiceId, { ingredientId: picked.id, qty: qn, unitCostDollars: cn });
        toast({ title: `${picked.name} added` });
        setPicked(null); setQ(""); setQty("1"); setCost("0");
        router.refresh();
      } catch (err: any) {
        toast({ title: "Could not add", description: String(err?.message ?? err), variant: "destructive" });
      }
    });
  };

  const remove = (itemId: string, name: string) => {
    start(async () => {
      try {
        await removeInvoiceItemAction(invoiceId, itemId);
        toast({ title: `${name} removed` });
        router.refresh();
      } catch (err: any) {
        toast({ title: "Could not remove", description: String(err?.message ?? err), variant: "destructive" });
      }
    });
  };

  const lineTotalPreview = (Number(qty) || 0) * (Number(cost) || 0);

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Unit Cost</TableHead>
              <TableHead className="text-right">Line Total</TableHead>
              {!readOnly && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((it) => (
              <TableRow key={it.id}>
                <TableCell className="font-medium">{it.ingredientName}</TableCell>
                <TableCell className="text-muted-foreground">{it.category ?? "—"}</TableCell>
                <TableCell className="text-right num">{it.qty.toFixed(2)}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{it.unit}</TableCell>
                <TableCell className="text-right num">{fmt(it.unitCostDollars)}</TableCell>
                <TableCell className="text-right num font-medium">{fmt(it.lineTotalDollars)}</TableCell>
                {!readOnly && (
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => remove(it.id, it.ingredientName)} disabled={pending} aria-label="Remove">
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={readOnly ? 6 : 7} className="text-center text-sm text-muted-foreground py-6">
                  No line items — this invoice uses the totals entered above.
                  {readOnly ? "" : " Add items below only if you want per-ingredient stock & cost tracking (they replace the manual amount)."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {!readOnly && (
        <div className="rounded-md border bg-muted/30 p-3 space-y-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Add line item</div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-end">
            <div className="grid gap-1.5">
              <label className="text-xs">Search ingredient (name or SKU)</label>
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-7" placeholder="e.g. milk, MLK01" value={q} onChange={(e) => { setQ(e.target.value); setPicked(null); }} />
              </div>
              {q && !picked && (
                <div className="rounded border bg-popover max-h-56 overflow-y-auto text-sm">
                  {results.length === 0 && (
                    <div className="p-2 text-xs text-muted-foreground">No matches — add this as a new ingredient below.</div>
                  )}
                  {results.map((ing) => (
                    <button
                      type="button"
                      key={ing.id}
                      onClick={() => pick(ing)}
                      className="w-full text-left px-2 py-1.5 hover:bg-accent flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">{ing.name}</div>
                        <div className="text-2xs text-muted-foreground truncate">
                          {ing.sku ? `${ing.sku} · ` : ""}{ing.category ?? "—"} · {ing.unit}
                        </div>
                      </div>
                      <Badge variant="muted" className="num shrink-0">${(ing.lastCostCents/100).toFixed(2)}</Badge>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={openCreate}
                    className="sticky bottom-0 w-full text-left px-2 py-2 border-t bg-popover hover:bg-accent flex items-center gap-2 text-brand-ink font-medium"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Create &quot;{q.trim() || "new ingredient"}&quot;
                  </button>
                </div>
              )}
              {picked && (
                <div className="rounded border p-2 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-medium">{picked.name}</span>
                    <span className="text-muted-foreground ml-1">({picked.unit})</span>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setPicked(null)}>Change</Button>
                </div>
              )}
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs">Qty</label>
              <Input type="number" step="0.01" min="0.01" value={qty} onChange={(e) => setQty(e.target.value)} className="w-24 num text-right" />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs">$/unit</label>
              <Input type="number" step="0.01" min="0" value={cost} onChange={(e) => setCost(e.target.value)} className="w-28 num text-right" />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs">Line</label>
              <div className="num text-right h-9 inline-flex items-center font-medium pr-2 min-w-20">{fmt(lineTotalPreview)}</div>
            </div>
            <Button type="button" onClick={add} disabled={!picked || pending}><Plus className="h-3.5 w-3.5" /> Add</Button>
          </div>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create new ingredient</DialogTitle></DialogHeader>
          <div className="grid gap-3 text-sm">
            <div className="grid gap-1.5">
              <Label htmlFor="qi-name">Name</Label>
              <Input
                id="qi-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Whole milk"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="qi-unit">Unit</Label>
                <UnitSelect id="qi-unit" value={newUnit} onValueChange={setNewUnit} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="qi-cost">Last cost ($/unit)</Label>
                <Input
                  id="qi-cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={newCost}
                  onChange={(e) => setNewCost(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="qi-cat">Category (optional)</Label>
              <CategorySelect
                id="qi-cat"
                options={INGREDIENT_CATEGORIES}
                value={newCategory}
                onValueChange={setNewCategory}
              />
            </div>
            <p className="text-2xs text-muted-foreground">
              Par level, reorder point, and SKU default to zero — you can refine these later from{" "}
              <span className="font-medium">Inventory</span>.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
            <Button type="button" onClick={submitCreate} disabled={creating}>
              {creating ? "Creating..." : "Create & use"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
