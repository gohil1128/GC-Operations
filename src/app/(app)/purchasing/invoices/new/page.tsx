import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCapability } from "@/lib/scope";
import { listSuppliersForInvoice } from "@/modules/invoices/queries";
import { listActiveEvents } from "@/modules/events/queries";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NewInvoiceForm } from "../../_components/new-invoice-form";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage() {
  const scope = await requireCapability("purchasing");
  const [suppliers, events] = await Promise.all([
    listSuppliersForInvoice(scope.businessId),
    listActiveEvents(scope.businessId),
  ]);
  const eventProps = events.map((e) => ({ id: e.id, name: e.name, color: e.color }));
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div>
      <PageHeader
        eyebrow="Purchasing · New invoice"
        title="Create invoice"
        description={`Recording a new supplier bill at ${scope.locationName}`}
        actions={
          <Button asChild variant="outline" size="sm"><Link href="/purchasing/invoices"><ArrowLeft className="h-3.5 w-3.5" /> All invoices</Link></Button>
        }
      />
      <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-5 sm:px-6 lg:px-8">
        <Card className="max-w-3xl">
          <CardHeader><CardTitle>Invoice details</CardTitle></CardHeader>
          <CardContent>
            <NewInvoiceForm
              suppliers={suppliers}
              events={eventProps}
              locationName={scope.locationName}
              defaultDate={today}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
