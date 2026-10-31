"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhotoInput } from "@/components/ui/photo-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategorySelect } from "@/components/ui/category-select";
import { INVOICE_CATEGORIES } from "@/lib/gc-categories";
import { createInvoiceAction } from "@/modules/invoices/actions";
import { quickCreateSupplierAction } from "@/modules/purchasing/actions";
import { fileToAttachmentDataUrl } from "@/lib/image-client";
import { toast } from "@/components/ui/use-toast";

type Supplier = { id: string; name: string };
type Event = { id: string; name: string; color: string | null };

export function NewInvoiceForm({
  suppliers,
  events = [],
  locationName,
  defaultDate,
}: {
  suppliers: Supplier[];
  events?: Event[];
  locationName: string;
  defaultDate: string;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [supplierId, setSupplierId] = React.useState("");
  const [openPos, setOpenPos] = React.useState<{ id: string; orderedAt: string; totalCents: number }[]>([]);
  const [poId, setPoId] = React.useState<string>("");
  const [eventId, setEventId] = React.useState<string>("none");
  const [subtotal, setSubtotal] = React.useState("");
  const [gst, setGst] = React.useState("");
  const [pst, setPst] = React.useState("");
  const [imageDataUrl, setImageDataUrl] = React.useState<string>("");
  const [compressing, setCompressing] = React.useState(false);

  // Inline supplier creation — new suppliers land in this local list and get
  // selected immediately, no separate Suppliers page needed.
  const [supplierList, setSupplierList] = React.useState<Supplier[]>(suppliers);
  const [addingSupplier, setAddingSupplier] = React.useState(false);
  const [newSupplierName, setNewSupplierName] = React.useState("");
  const [savingSupplier, setSavingSupplier] = React.useState(false);

  const saveNewSupplier = async () => {
    if (!newSupplierName.trim() || savingSupplier) return;
    setSavingSupplier(true);
    try {
      const s = await quickCreateSupplierAction(newSupplierName);
      setSupplierList((list) => (list.some((x) => x.id === s.id) ? list : [...list, s].sort((a, b) => a.name.localeCompare(b.name))));
      setSupplierId(s.id);
      setAddingSupplier(false);
      setNewSupplierName("");
      toast({ title: `Supplier "${s.name}" added` });
    } catch (err: any) {
      toast({ title: "Could not add supplier", description: String(err?.message ?? err), variant: "destructive" });
    } finally {
      setSavingSupplier(false);
    }
  };

  const liveTotal = (Number(subtotal) || 0) + (Number(gst) || 0) + (Number(pst) || 0);

  const onPhoto = async (f: File) => {
    setCompressing(true);
    try {
      setImageDataUrl(await fileToAttachmentDataUrl(f));
    } catch (err: any) {
      toast({ title: "Could not read the file", description: String(err?.message ?? ""), variant: "destructive" });
    } finally {
      setCompressing(false);
    }
  };

  React.useEffect(() => {
    if (!supplierId) { setOpenPos([]); setPoId(""); return; }
    fetch(`/api/purchasing/invoices/open-pos?supplierId=${supplierId}`)
      .then((r) => r.ok ? r.json() : { pos: [] })
      .then((d) => setOpenPos(d.pos))
      .catch(() => setOpenPos([]));
  }, [supplierId]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        if (poId) fd.set("poId", poId);
        fd.set("eventId", eventId);
        if (imageDataUrl) fd.set("imageDataUrl", imageDataUrl);
        start(async () => {
          try {
            await createInvoiceAction(fd);
          } catch (err: any) {
            if (err?.digest?.startsWith("NEXT_REDIRECT")) return;
            toast({ title: "Could not create invoice", description: String(err?.message ?? err), variant: "destructive" });
          }
        });
      }}
      className="grid gap-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="supplierId">Supplier</Label>
          <Select name="supplierId" value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger id="supplierId"><SelectValue placeholder="Pick supplier" /></SelectTrigger>
            <SelectContent>
              {supplierList.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {addingSupplier ? (
            <div className="flex items-center gap-1.5">
              <Input
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                placeholder="Supplier name"
                className="h-8 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); saveNewSupplier(); }
                  if (e.key === "Escape") setAddingSupplier(false);
                }}
              />
              <Button type="button" size="sm" variant="brand" className="h-8" disabled={savingSupplier || !newSupplierName.trim()} onClick={saveNewSupplier}>
                {savingSupplier ? "Adding…" : "Add"}
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setAddingSupplier(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingSupplier(true)}
              className="self-start inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
            >
              <Plus className="h-3 w-3" /> New supplier
            </button>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label>Store</Label>
          <Input value={locationName} disabled />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="poId">Create from PO (optional)</Label>
          <Select value={poId} onValueChange={setPoId} disabled={!supplierId}>
            <SelectTrigger><SelectValue placeholder={supplierId ? (openPos.length === 0 ? "No open POs" : "Pick a PO to copy items") : "Pick a supplier first"} /></SelectTrigger>
            <SelectContent>
              {openPos.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  #{p.id.slice(-6).toUpperCase()} · {new Date(p.orderedAt).toLocaleDateString()} · ${(p.totalCents/100).toFixed(2)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="invoiceDate">Invoice Date</Label>
          <Input id="invoiceDate" name="invoiceDate" type="date" required defaultValue={defaultDate} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="dateReceived">Date Received</Label>
          <Input id="dateReceived" name="dateReceived" type="date" required defaultValue={defaultDate} />
        </div>
      </div>

      {/* Totals-only entry — no need to list every ingredient */}
      <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Amounts — just enter the bill totals
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="subtotalDollars">Amount before tax ($)</Label>
            <Input
              id="subtotalDollars" name="subtotalDollars" type="number" step="0.01" min="0"
              value={subtotal} onChange={(e) => setSubtotal(e.target.value)} placeholder="0.00"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="gstDollars">GST ($)</Label>
            <Input
              id="gstDollars" name="gstDollars" type="number" step="0.01" min="0"
              value={gst} onChange={(e) => setGst(e.target.value)} placeholder="0.00"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pstDollars">PST ($)</Label>
            <Input
              id="pstDollars" name="pstDollars" type="number" step="0.01" min="0"
              value={pst} onChange={(e) => setPst(e.target.value)} placeholder="0.00"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Total</Label>
            {/* brand-ink, not brand: the rust is an accent tuned for fills and
                measured 4.25:1 as a 16px label on the panel. Same fix the
                reports totals already carry. */}
            <div className="num h-9 inline-flex items-center font-semibold text-brand-ink">
              ${liveTotal.toFixed(2)}
            </div>
          </div>
        </div>
        <p className="text-2xs text-muted-foreground">
          Listing individual ingredients is optional — you can add line items later on the invoice
          page if you want per-ingredient stock and cost tracking. If you do, they replace the
          amount entered here.
        </p>
      </div>

      {/* Photo of the paper invoice */}
      <div className="grid gap-1.5">
        <Label htmlFor="invoice-photo">Invoice photo or PDF (optional)</Label>
        {imageDataUrl ? (
          <div className="flex items-start gap-3">
            {imageDataUrl.startsWith("data:application/pdf") ? (
              <span className="inline-flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm font-medium">
                <FileText className="h-4 w-4 text-brand" /> PDF attached
              </span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageDataUrl} alt="Invoice" className="h-28 w-auto rounded-lg border object-cover" />
            )}
            <Button type="button" variant="ghost" size="sm" onClick={() => setImageDataUrl("")}>
              <X className="h-3.5 w-3.5" /> Remove
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <PhotoInput onPick={onPhoto} disabled={compressing} allowPdf />
            {compressing && <span className="text-2xs text-muted-foreground">processing…</span>}
          </div>
        )}
        <span className="text-2xs text-muted-foreground">
          Snap the paper bill, pick a photo from your gallery / computer, or upload a PDF invoice.
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {events.length > 0 && (
          <div className="grid gap-1.5">
            <Label htmlFor="invoice-event">Event (optional)</Label>
            <Select value={eventId} onValueChange={setEventId}>
              <SelectTrigger id="invoice-event"><SelectValue placeholder="No event" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No event</SelectItem>
                <SelectItem value="all">
                  <span className="inline-flex items-center gap-2 font-medium">🌐 All events (shared cost)</span>
                </SelectItem>
                {events.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: e.color ?? "hsl(var(--muted-foreground))" }} />
                      {e.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-2xs text-muted-foreground">Or &ldquo;All events&rdquo; for shared costs (cups, tent…), split evenly in the P&amp;L.</span>
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="invoice-category">Category (optional)</Label>
          <CategorySelect id="invoice-category" name="category" options={INVOICE_CATEGORIES} />
          <span className="text-2xs text-muted-foreground">What the bill was for — powers the spend-by-category report.</span>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="internalMemo">Internal Memo</Label>
        <Textarea id="internalMemo" name="internalMemo" rows={3} />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.push("/purchasing/invoices")}>Reset</Button>
        <Button type="submit" disabled={pending || !supplierId}>{pending ? "Creating..." : "Create"}</Button>
      </div>
    </form>
  );
}
