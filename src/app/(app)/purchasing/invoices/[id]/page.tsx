import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock, Unlock, Plus } from "lucide-react";
import { requireCapability } from "@/lib/scope";
import { getInvoice } from "@/modules/invoices/queries";
import { listActiveEvents } from "@/modules/events/queries";
import { closeInvoiceAction, deleteInvoiceAction } from "@/modules/invoices/actions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteButton } from "@/components/delete-button";
import { fmtDate, fmtDateTime } from "@/lib/date";
import { fromCents } from "@/lib/money";
import { InvoiceDetailForm } from "../../_components/invoice-detail-form";
import { InvoiceItemsTable } from "../../_components/invoice-items-table";
import { CloseInvoiceButton } from "../../_components/close-invoice-button";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireCapability("purchasing");
  const inv = await getInvoice(scope.locationId, id);
  if (!inv) notFound();
  const events = await listActiveEvents(scope.businessId);
  const eventProps = events.map((e) => ({ id: e.id, name: e.name, color: e.color }));

  const numberOfItems = inv.items.length;
  const qtyReceived = inv.items.reduce((a, it) => a + it.qty, 0);

  return (
    <div>
      <PageHeader
        title={`${inv.supplier.name} invoice`}
        description={`${inv.supplier.name} · ${inv.location.name} · created ${fmtDateTime(inv.createdAt)} by ${inv.createdBy.name}`}
        actions={
          <>
            <Button asChild variant="outline" size="sm"><Link href="/purchasing/invoices"><ArrowLeft className="h-3.5 w-3.5" /> All invoices</Link></Button>
            <Button asChild variant="brand" size="sm"><Link href="/purchasing/invoices/new"><Plus className="h-3.5 w-3.5" /> New invoice</Link></Button>
            {inv.closedAt
              ? <Badge variant="muted" className="gap-1"><Lock className="h-3 w-3" /> Closed</Badge>
              : <Badge variant="success" className="gap-1"><Unlock className="h-3 w-3" /> Editable</Badge>}
            <CloseInvoiceButton id={inv.id} closed={!!inv.closedAt} />
            <DeleteButton
              action={deleteInvoiceAction.bind(null, inv.id)}
              itemLabel="invoice"
              itemName={`${inv.supplier.name} · ${fmtDate(inv.invoiceDate)}`}
              confirmText={`This will delete this ${inv.supplier.name} invoice and reverse ${numberOfItems} inventory items added by it.`}
              variant="outline"
              size="sm"
            >
              <span>Delete</span>
            </DeleteButton>
          </>
        }
      />
      <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-5 sm:px-6 lg:px-8 space-y-4">
        {inv.closedAt ? (
          <div className="rounded-lg border border-muted-foreground/30 bg-muted/30 text-muted-foreground px-3 py-2 text-xs flex items-center gap-2">
            <Lock className="h-3.5 w-3.5" /> Closed {fmtDateTime(inv.closedAt)}. Fields are locked. Click <span className="font-medium">Re-open</span> above to edit.
          </div>
        ) : (
          <div className="rounded-lg border border-success/25 bg-success-muted text-success px-3 py-2 text-xs flex items-center gap-2">
            <Unlock className="h-3.5 w-3.5" /> Open for editing. Change any field below and click <span className="font-medium">Update</span> at the bottom to save. Add line items in the Line items section.
          </div>
        )}

        <Card>
          <CardHeader><CardTitle>Invoice header & totals</CardTitle></CardHeader>
          <CardContent>
            <InvoiceDetailForm
              invoiceId={inv.id}
              readOnly={!!inv.closedAt}
              events={eventProps}
              initial={{
                supplierName: inv.supplier.name,
                locationName: inv.location.name,
                createdByName: inv.createdBy.name,
                createdAt: fmtDateTime(inv.createdAt),
                invoiceDate: inv.invoiceDate.toISOString().slice(0, 10),
                dateReceived: inv.dateReceived.toISOString().slice(0, 10),
                internalMemo: inv.internalMemo ?? "",
                eventId: inv.eventId ?? null,
                appliesToAllEvents: inv.appliesToAllEvents,
                category: inv.category ?? null,
                imageDataUrl: inv.imageDataUrl ?? null,
                subtotalDollars: fromCents(inv.subtotalCents),
                gstDollars: fromCents(inv.gstCents),
                pstDollars: fromCents(inv.pstCents),
                shippingDollars: fromCents(inv.shippingCents),
                rebateDollars: fromCents(inv.rebateCents),
                totalDollars: fromCents(inv.totalCents),
                numberOfItems,
                qtyReceived,
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Line items</CardTitle></CardHeader>
          <CardContent>
            <InvoiceItemsTable
              invoiceId={inv.id}
              supplierId={inv.supplierId}
              readOnly={!!inv.closedAt}
              items={inv.items.map((it) => ({
                id: it.id,
                ingredientName: it.ingredient.name,
                category: it.ingredient.category ?? null,
                qty: it.qty,
                unit: it.unit,
                unitCostDollars: fromCents(it.unitCostCents),
                lineTotalDollars: fromCents(it.lineTotalCents),
              }))}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button asChild variant="outline" size="sm"><Link href="/purchasing/invoices"><ArrowLeft className="h-3.5 w-3.5" /> Back to all invoices</Link></Button>
          <Button asChild variant="brand" size="sm"><Link href="/purchasing/invoices/new"><Plus className="h-3.5 w-3.5" /> Enter another invoice</Link></Button>
        </div>
      </div>
    </div>
  );
}
