"use client";
import * as React from "react";
import { Minus, Plus, Search, Share, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { fmtBusinessDate } from "@/lib/date";
import { useDraftState, clearDraft } from "@/lib/use-draft";
import { toast } from "@/components/ui/use-toast";
import type { OrderableItem } from "@/modules/ordering/queries";

/*
  The order portal: every item bought before, grouped by who it came from,
  each with a quantity. Quantities are kept on this device until the order is
  shared or cleared, so a half-made order survives leaving the page.

  Share hands one CSV file (supplier, item, quantity, unit, last price, line
  estimate) to the phone's share sheet, so it can go by message, email or
  Files. Where sharing files is not possible, it downloads instead. The same
  order also goes along as plain text, for apps that only take text.
*/
const DRAFT = "order-portal";

const qtyFmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""));

function csvCell(v: string | number) {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // never a formula in Excel
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function OrderPortal({ items, businessName, todayIso }: { items: OrderableItem[]; businessName: string; todayIso: string }) {
  const [qty, setQty] = useDraftState<Record<string, number>>(DRAFT, "qty", {});
  const [note, setNote] = useDraftState<string>(DRAFT, "note", "");
  const [q, setQ] = React.useState("");
  const [onlyChosen, setOnlyChosen] = React.useState(false);
  const [supplier, setSupplier] = React.useState("all");

  const suppliers = React.useMemo(() => [...new Set(items.map((i) => i.supplierName))], [items]);
  const chosen = items.filter((i) => (qty[i.ingredientId] ?? 0) > 0);
  const estimate = chosen.reduce((a, i) => a + Math.round(qty[i.ingredientId] * i.lastUnitCostCents), 0);

  const query = q.trim().toLowerCase();
  const visible = items.filter(
    (i) =>
      (!onlyChosen || (qty[i.ingredientId] ?? 0) > 0) &&
      (supplier === "all" || i.supplierName === supplier) &&
      (!query || `${i.name} ${i.supplierName} ${i.category ?? ""} ${i.sku ?? ""}`.toLowerCase().includes(query)),
  );
  const groups = suppliers
    .map((s) => ({ name: s, rows: visible.filter((i) => i.supplierName === s) }))
    .filter((g) => g.rows.length > 0);

  const set = (id: string, v: number) =>
    setQty((cur) => {
      const next = { ...cur };
      const n = Math.max(0, Math.round(v * 100) / 100);
      if (n > 0) next[id] = n;
      else delete next[id];
      return next;
    });

  const share = async () => {
    if (chosen.length === 0) return;
    const header = ["Supplier", "Item", "SKU", "Quantity", "Unit", "Last price", "Estimate"];
    const rows = chosen.map((i) => [
      i.supplierName, i.name, i.sku ?? "", qtyFmt(qty[i.ingredientId]), i.unit,
      (i.lastUnitCostCents / 100).toFixed(2), ((qty[i.ingredientId] * i.lastUnitCostCents) / 100).toFixed(2),
    ]);
    const csv = [header, ...rows, [], ["", "", "", "", "", "Total", (estimate / 100).toFixed(2)], ...(note ? [[], ["Note", note]] : [])]
      .map((r) => r.map(csvCell).join(","))
      .join("\n");
    const text = [
      `${businessName} order · ${fmtBusinessDate(todayIso, "MMM d, yyyy")}`,
      ...suppliers.flatMap((s) => {
        const mine = chosen.filter((i) => i.supplierName === s);
        return mine.length ? ["", s, ...mine.map((i) => `• ${i.name}: ${qtyFmt(qty[i.ingredientId])} ${i.unit}`)] : [];
      }),
      ...(note ? ["", `Note: ${note}`] : []),
    ].join("\n");
    const name = `order-${todayIso}.csv`;
    const file = new File([csv], name, { type: "text/csv" });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Order ${todayIso}`, text });
        return;
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
    const url = URL.createObjectURL(file);
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    try { await navigator.clipboard?.writeText(text); toast({ title: "Order saved as a file", description: "The text version is copied too." }); }
    catch { toast({ title: "Order saved as a file" }); }
  };

  if (items.length === 0) {
    return (
      <div className="rounded-3xl bg-card p-8 text-center text-sm text-muted-foreground">
        Nothing bought yet. Items appear here once an invoice or purchase order has line items.
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="space-y-2">
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items or suppliers" aria-label="Search items"
            className="h-11 w-full rounded-full border-0 bg-muted/60 pl-10 pr-4 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4" data-no-swipe>
          {[["all", "All"], ...suppliers.map((s) => [s, s])].map(([k, label]) => (
            <button
              key={k} type="button" onClick={() => setSupplier(k)}
              className={cn("h-9 shrink-0 whitespace-nowrap rounded-full px-3.5 text-xs font-medium", supplier === k ? "bg-foreground text-background" : "bg-muted/60 text-muted-foreground")}
            >
              {label}
            </button>
          ))}
          <button
            type="button" onClick={() => setOnlyChosen((v) => !v)} aria-pressed={onlyChosen}
            className={cn("h-9 shrink-0 whitespace-nowrap rounded-full px-3.5 text-xs font-medium", onlyChosen ? "bg-brand-muted text-brand-ink" : "bg-muted/60 text-muted-foreground")}
          >
            In order · {chosen.length}
          </button>
        </div>
      </div>

      {groups.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nothing matches.</p>}

      {groups.map((g) => (
        <section key={g.name} aria-label={g.name}>
          <h2 className="mb-1 px-1 text-[11px] font-medium tracking-[0.04em] text-muted-foreground/80">{g.name}</h2>
          <ul className="rounded-3xl bg-card px-3 [&>li+li]:border-t [&>li+li]:border-border-soft/50">
            {g.rows.map((i) => {
              const n = qty[i.ingredientId] ?? 0;
              const low = i.parLevel > 0 && i.onHand < i.parLevel;
              return (
                <li key={i.ingredientId} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-medium leading-snug">{i.name}</div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {formatMoney(i.lastUnitCostCents)}/{i.unit} · last {qtyFmt(i.lastQty)} on {fmtBusinessDate(i.lastBoughtAt, "MMM d")}
                      {low && <span className="text-warning-ink"> · low</span>}
                    </div>
                  </div>
                  {n === 0 ? (
                    <button
                      type="button" onClick={() => set(i.ingredientId, i.lastQty > 0 ? i.lastQty : 1)}
                      aria-label={`Add ${i.name}`}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted/60 text-foreground active:bg-muted"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  ) : (
                    <div className="flex shrink-0 items-center rounded-full bg-brand-muted text-brand-ink">
                      <button type="button" onClick={() => set(i.ingredientId, n - 1)} aria-label={`One less ${i.name}`} className="grid h-10 w-9 place-items-center">
                        <Minus className="h-4 w-4" />
                      </button>
                      <input
                        type="number" inputMode="decimal" min={0} step="any" value={n}
                        onChange={(e) => set(i.ingredientId, Number(e.target.value) || 0)}
                        aria-label={`Quantity of ${i.name} in ${i.unit}`}
                        className="h-10 w-12 bg-transparent text-center text-sm font-semibold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button type="button" onClick={() => set(i.ingredientId, n + 1)} aria-label={`One more ${i.name}`} className="grid h-10 w-9 place-items-center">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {chosen.length > 0 && (
        <label className="block">
          <span className="mb-1 block px-1 text-[11px] font-medium tracking-[0.04em] text-muted-foreground/80">Note for the supplier</span>
          <textarea
            value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Delivery day, substitutions…"
            className="w-full rounded-2xl border-0 bg-muted/60 px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </label>
      )}

      {/* The order bar sits just above the dock while anything is in the order. */}
      {chosen.length > 0 && (
        <div className="fixed inset-x-4 bottom-[calc(6.5rem+env(safe-area-inset-bottom,0px))] z-40 mx-auto flex max-w-xl items-center gap-2 rounded-full bg-foreground p-1.5 pl-5 text-background shadow-lg lg:bottom-6">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{chosen.length} item{chosen.length === 1 ? "" : "s"}</div>
            <div className="truncate text-2xs opacity-70">about {formatMoney(estimate)} at last prices</div>
          </div>
          <button
            type="button" onClick={() => { setQty({}); setNote(""); clearDraft(DRAFT); }} aria-label="Clear the order"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full opacity-70 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            type="button" onClick={share}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-highlight px-4 text-sm font-semibold text-highlight-foreground"
          >
            <Share className="h-4 w-4" /> Share order
          </button>
        </div>
      )}
    </div>
  );
}
