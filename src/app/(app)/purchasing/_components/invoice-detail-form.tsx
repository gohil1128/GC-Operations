"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhotoInput } from "@/components/ui/photo-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategorySelect } from "@/components/ui/category-select";
import { INVOICE_CATEGORIES } from "@/lib/gc-categories";
import { updateInvoiceAction, setInvoiceEventAction, setInvoiceCategoryAction, setInvoiceImageAction } from "@/modules/invoices/actions";
import { impossibleInvoiceReason, invoiceDiscountWarning } from "@/modules/invoices/checks";
import { fileToAttachmentDataUrl } from "@/lib/image-client";
import { toast } from "@/components/ui/use-toast";

type Event = { id: string; name: string; color: string | null };

type Initial = {
  supplierName: string;
  locationName: string;
  createdByName: string;
  createdAt: string;
  invoiceDate: string;
  dateReceived: string;
  internalMemo: string;
  eventId: string | null;
  appliesToAllEvents: boolean;
  category: string | null;
  imageDataUrl: string | null;
  subtotalDollars: number;
  gstDollars: number;
  pstDollars: number;
  shippingDollars: number;
  rebateDollars: number;
  totalDollars: number;
  numberOfItems: number;
  qtyReceived: number;
};

const fmt = (n: number) => `$${n.toFixed(2)}`;
// Rounded the way toCents rounds on the server, so the check the form runs
// and the check the action runs cannot disagree on a half-cent.
const cents = (n: number) => Math.round(n * 100);

export function InvoiceDetailForm({ invoiceId, initial, events = [], readOnly }: { invoiceId: string; initial: Initial; events?: Event[]; readOnly: boolean }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [eventPending, startEvent] = React.useTransition();
  const [eventId, setEventId] = React.useState<string>(initial.appliesToAllEvents ? "all" : (initial.eventId ?? "none"));
  const [categoryPending, startCategory] = React.useTransition();
  const [category, setCategory] = React.useState<string>(initial.category ?? "");
  const [invoiceDate, setInvoiceDate] = React.useState(initial.invoiceDate);
  const [dateReceived, setDateReceived] = React.useState(initial.dateReceived);
  const [internalMemo, setInternalMemo] = React.useState(initial.internalMemo);
  const [subtotal, setSubtotal] = React.useState(String(initial.subtotalDollars));
  const [gst, setGst] = React.useState(String(initial.gstDollars));
  const [pst, setPst] = React.useState(String(initial.pstDollars));
  const [shipping, setShipping] = React.useState(String(initial.shippingDollars));
  const [rebate, setRebate] = React.useState(String(initial.rebateDollars));
  const [image, setImage] = React.useState<string | null>(initial.imageDataUrl);
  const [imagePending, startImage] = React.useTransition();
  const hasItems = initial.numberOfItems > 0;

  const saveImage = (dataUrl: string | null) => {
    startImage(async () => {
      try {
        await setInvoiceImageAction(invoiceId, dataUrl);
        setImage(dataUrl);
        toast({ title: dataUrl ? "Photo attached" : "Photo removed" });
        router.refresh();
      } catch (err: any) {
        toast({ title: "Photo failed", description: String(err?.message ?? err), variant: "destructive" });
      }
    });
  };

  const onPhotoPick = async (f: File) => {
    try {
      saveImage(await fileToAttachmentDataUrl(f));
    } catch (err: any) {
      toast({ title: "Could not read the file", description: String(err?.message ?? ""), variant: "destructive" });
    }
  };

  const onCategoryChange = (next: string) => {
    setCategory(next);
    startCategory(async () => {
      try {
        await setInvoiceCategoryAction(invoiceId, next || null);
        toast({ title: "Category updated" });
        router.refresh();
      } catch (err: any) {
        toast({ title: "Could not set category", description: String(err?.message ?? err), variant: "destructive" });
      }
    });
  };

  // Event tagging works independently of open/closed state — retag any invoice.
  const onEventChange = (next: string) => {
    setEventId(next);
    startEvent(async () => {
      try {
        await setInvoiceEventAction(invoiceId, next === "none" ? null : next);
        toast({ title: "Event updated" });
        router.refresh();
      } catch (err: any) {
        toast({ title: "Could not set event", description: String(err?.message ?? err), variant: "destructive" });
      }
    });
  };

  // With line items, subtotal is locked to their sum; totals-only invoices
  // use the editable manual subtotal.
  const effectiveSubtotal = hasItems ? initial.subtotalDollars : Number(subtotal) || 0;
  const liveTotal =
    effectiveSubtotal +
    (Number(gst) || 0) +
    (Number(pst) || 0) +
    (Number(shipping) || 0) -
    (Number(rebate) || 0);

  /*
    The same two checks the server runs, against what is on screen right now.
    Shown while typing rather than only on save, because the figure that
    breaks them — the rebate — is three boxes away from the total it drags
    under, and the connection is not obvious once the form has been submitted
    and the page has moved.
  */
  const amounts = {
    subtotalCents: cents(effectiveSubtotal),
    gstCents: cents(Number(gst) || 0),
    pstCents: cents(Number(pst) || 0),
    shippingCents: cents(Number(shipping) || 0),
    rebateCents: cents(Number(rebate) || 0),
  };
  const refusal = impossibleInvoiceReason(amounts);
  const discountNote = refusal
    ? null
    : invoiceDiscountWarning({ subtotalCents: amounts.subtotalCents, totalCents: cents(liveTotal) });

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    fd.set("invoiceDate", invoiceDate);
    fd.set("dateReceived", dateReceived);
    fd.set("internalMemo", internalMemo);
    fd.set("subtotalDollars", subtotal);
    fd.set("gstDollars", gst);
    fd.set("pstDollars", pst);
    fd.set("shippingDollars", shipping);
    fd.set("rebateDollars", rebate);
    start(async () => {
      try {
        const res = await updateInvoiceAction(invoiceId, fd);
        if ("error" in res) {
          toast({ title: "Not saved", description: res.error, variant: "destructive" });
          return;
        }
        toast({ title: "Invoice updated" });
        router.refresh();
      } catch (err: any) {
        toast({ title: "Save failed", description: String(err?.message ?? err), variant: "destructive" });
      }
    });
  };

  return (
    <form onSubmit={save} className="grid gap-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <Read label="Supplier" value={initial.supplierName} />
        <Read label="Store" value={initial.locationName} />
        <Read label="Created by" value={`${initial.createdByName} · ${initial.createdAt}`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="invDate">Invoice Date</Label>
          <Input id="invDate" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} disabled={readOnly} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="dr">Date Received</Label>
          <Input id="dr" type="date" value={dateReceived} onChange={(e) => setDateReceived(e.target.value)} disabled={readOnly} required />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
        {hasItems ? (
          <Read label="Sub Total (from items)" value={fmt(initial.subtotalDollars)} bold />
        ) : (
          <Field id="subtotal" label="Amount before tax" value={subtotal} onChange={setSubtotal} disabled={readOnly} />
        )}
        <Field id="gst" label="GST" value={gst} onChange={setGst} disabled={readOnly} />
        <Field id="pst" label="PST" value={pst} onChange={setPst} disabled={readOnly} />
        <Field id="ship" label="Shipping" value={shipping} onChange={setShipping} disabled={readOnly} />
        <Field id="rebate" label="Rebate/Discount" value={rebate} onChange={setRebate} disabled={readOnly} />
        <Read label="Total" value={fmt(liveTotal)} bold accent />
        <Read label="Items / Qty Received" value={`${initial.numberOfItems} · ${initial.qtyReceived.toFixed(2)}`} />
      </div>

      {(refusal || discountNote) && (
        <p
          data-testid={refusal ? "invoice-refusal" : "invoice-discount-note"}
          className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs leading-relaxed ${
            refusal
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-warning/40 bg-warning/10 text-warning"
          }`}
        >
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{refusal ?? discountNote}</span>
        </p>
      )}

      {/* Attached photo of the paper invoice — editable even when closed */}
      <div className="grid gap-1.5">
        <Label>Invoice photo / PDF {imagePending && <span className="text-2xs text-muted-foreground">· saving…</span>}</Label>
        {image ? (
          <div className="flex items-start gap-3">
            <a href={`/api/purchasing/invoices/${invoiceId}/photo`} target="_blank" rel="noreferrer" title="Open full size">
              {image.startsWith("data:application/pdf") ? (
                <span className="inline-flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm font-medium hover:bg-accent transition-colors">
                  <FileText className="h-4 w-4 text-brand" /> PDF attached — open
                </span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="Invoice" className="h-32 w-auto rounded-lg border object-cover hover:opacity-90 transition-opacity" />
              )}
            </a>
            <div className="flex flex-col gap-2">
              <PhotoInput onPick={onPhotoPick} disabled={imagePending} allowPdf />
              <button type="button" onClick={() => saveImage(null)} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive">
                <X className="h-3.5 w-3.5" /> Remove
              </button>
            </div>
          </div>
        ) : (
          <PhotoInput onPick={onPhotoPick} disabled={imagePending} allowPdf />
        )}
        <span className="text-2xs text-muted-foreground">Saved instantly — works even when the invoice is closed.</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {events.length > 0 && (
          <div className="grid gap-1.5">
            <Label htmlFor="inv-event">Event {eventPending && <span className="text-2xs text-muted-foreground">· saving…</span>}</Label>
            <Select value={eventId} onValueChange={onEventChange}>
              <SelectTrigger id="inv-event"><SelectValue placeholder="No event" /></SelectTrigger>
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
            <span className="text-2xs text-muted-foreground">Saved instantly — works even when the invoice is closed.</span>
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="inv-category">Category {categoryPending && <span className="text-2xs text-muted-foreground">· saving…</span>}</Label>
          <CategorySelect id="inv-category" options={INVOICE_CATEGORIES} value={category} onValueChange={onCategoryChange} />
          <span className="text-2xs text-muted-foreground">Saved instantly.</span>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="memo">Internal Memo</Label>
        <Textarea id="memo" rows={2} value={internalMemo} onChange={(e) => setInternalMemo(e.target.value)} disabled={readOnly} />
      </div>

      <div className="flex justify-end items-center gap-2 border-t pt-3 mt-2">
        {readOnly && <span className="text-xs text-muted-foreground">Re-open the invoice to save changes</span>}
        {/* Held rather than left to fail on the server: the reason is already
            on screen above, and letting the click through would only replace
            it with the same sentence in a toast. */}
        <Button type="submit" disabled={pending || readOnly || refusal !== null} size="default">
          {pending ? "Saving..." : "Update invoice"}
        </Button>
      </div>
    </form>
  );
}

function Field({ id, label, value, onChange, disabled }: { id: string; label: string; value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input id={id} type="number" step="0.01" min="0" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="num text-right h-8" />
    </div>
  );
}

function Read({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: boolean }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm num h-8 inline-flex items-center ${bold ? "font-semibold" : ""} ${accent ? "text-primary" : ""}`}>{value}</span>
    </div>
  );
}
