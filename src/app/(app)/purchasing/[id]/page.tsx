import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCapability } from "@/lib/scope";
import { getPurchaseOrder } from "@/modules/purchasing/queries";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/money";
import { fmtDate, fmtDateTime } from "@/lib/date";
import { PoActions } from "../_components/po-actions";

export const dynamic = "force-dynamic";

const statusVariant = (s: string) => (s === "DRAFT" ? "muted" : s === "SENT" ? "default" : s === "RECEIVED" ? "success" : "danger");

export default async function PoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireCapability("purchasing");
  const po = await getPurchaseOrder(scope.locationId, id);
  if (!po) notFound();
  return (
    <div>
      <PageHeader
        title={`PO #${po.id.slice(-6).toUpperCase()}`}
        description={`${po.supplier.name} · ${po.items.length} items · ${fmtDate(po.orderedAt)}`}
        actions={<Button asChild variant="outline" size="sm"><Link href="/purchasing"><ArrowLeft className="h-3.5 w-3.5" /> All POs</Link></Button>}
      />
      <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-5 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Status" value={<Badge variant={statusVariant(po.status) as any}>{po.status}</Badge>} />
            <Row label="Supplier" value={po.supplier.name} />
            <Row label="Ordered" value={fmtDate(po.orderedAt)} />
            <Row label="Expected" value={po.expectedAt ? fmtDate(po.expectedAt) : "—"} />
            <Row label="Received" value={po.receivedAt ? fmtDateTime(po.receivedAt) : "—"} />
            <Row label="Subtotal" value={formatMoney(po.subtotalCents)} />
            <Row label="Total" value={formatMoney(po.totalCents)} />
            <Row label="Created by" value={po.createdBy.name} />
            {po.notes && <div className="pt-2"><span className="text-xs text-muted-foreground">Notes</span><p className="text-sm">{po.notes}</p></div>}
            <div className="pt-3">
              <p className="text-xs text-muted-foreground mb-1">Invoice upload</p>
              <Button variant="outline" size="sm" disabled>Upload invoice (coming soon)</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Line items</CardTitle>
            <PoActions poId={po.id} status={po.status} />
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingredient</TableHead>
                  <TableHead className="text-right">Qty Ordered</TableHead>
                  <TableHead className="text-right">Qty Received</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead className="text-right">Line $</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {po.items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium">{it.ingredient.name}</TableCell>
                    <TableCell className="text-right num">{it.qtyOrdered.toFixed(2)} {it.unit}</TableCell>
                    <TableCell className={`text-right num ${it.qtyReceived < it.qtyOrdered ? "text-warning" : ""}`}>{it.qtyReceived.toFixed(2)}</TableCell>
                    <TableCell className="text-right num">{formatMoney(it.unitCostCents)}</TableCell>
                    <TableCell className="text-right num">{formatMoney(it.lineTotalCents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="num">{value}</span>
    </div>
  );
}
