"use client";
import { EventMark } from "@/components/event-mark";
import * as React from "react";
import { formatMoney } from "@/lib/money";
import { useRouter } from "next/navigation";
import { Plus, Wrench, Pencil, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DeleteButton } from "@/components/delete-button";
import { toast } from "@/components/ui/use-toast";
import {
  createCapitalAssetAction,
  updateCapitalAssetAction,
  deleteCapitalAssetAction,
} from "@/modules/capital/actions";
import { CAPITAL_CATEGORIES } from "@/modules/capital/schemas";
import { TableOnDesktop, MobileList, MobileRow, MobileField, MobileEmpty } from "@/components/mobile-list";

type Asset = {
  id: string;
  name: string;
  category: string | null;
  vendor: string | null;
  purchaseDate: string; // YYYY-MM-DD
  purchasePriceDollars: number;
  usefulLifeMonths: number | null;
  salvageValueDollars: number;
  status: "IN_SERVICE" | "SOLD" | "WRITTEN_OFF";
  notes: string;
  event: { id: string; name: string; color: string | null } | null;
  monthlyDepreciationDollars: number;
  netBookValueDollars: number;
};

type Event = { id: string; name: string; color: string | null };

// Shared formatter so thousands separators match the rest of the app.
const money = (n: number) => formatMoney(Math.round(n * 100));
const STATUS_LABEL: Record<Asset["status"], string> = {
  IN_SERVICE: "In service",
  SOLD: "Sold",
  WRITTEN_OFF: "Written off",
};

export function CapitalSection({ assets, events }: { assets: Asset[]; events: Event[] }) {
  const inService = assets.filter((a) => a.status === "IN_SERVICE");
  const totalInvested = inService.reduce((a, x) => a + x.purchasePriceDollars, 0);
  const totalNbv = inService.reduce((a, x) => a + x.netBookValueDollars, 0);
  const totalMonthlyDep = inService.reduce((a, x) => a + x.monthlyDepreciationDollars, 0);

  return (
    <Card className="border-warning/40">
      <CardHeader className="flex-col items-start gap-3 space-y-0 sm:flex-row sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="flex flex-wrap items-center gap-2">
            <Wrench className="h-4 w-4 text-warning" />
            Capital equipment
            <Badge variant="muted" className="ml-1">Separate from opex</Badge>
          </CardTitle>
          <CardDescription>
            High-cost equipment — hot holding unit, tea dispenser, fridge, etc. Tracked apart from
            regular operating expenses so EBITDA isn&apos;t distorted by one-time purchases.
            Optional straight-line depreciation gives you a monthly cost number.
          </CardDescription>
        </div>
        <div className="shrink-0"><NewAssetButton events={events} /></div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/30 p-3 text-center">
          <Stat label="Total invested" value={money(totalInvested)} sub={`${inService.length} in service`} />
          <Stat label="Net book value" value={money(totalNbv)} sub="Today, after depreciation" />
          <Stat label="Monthly depreciation" value={money(totalMonthlyDep)} sub="Straight-line, in-service" />
        </div>

        {assets.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No capital equipment logged yet. Track your hot holding unit, tea dispenser, fridge,
            etc. here to keep them out of your operating expenses.
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <TableOnDesktop>
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Life</TableHead>
                  <TableHead className="text-right">Net book</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="font-medium">{a.name}</div>
                      <div className="text-2xs text-muted-foreground">
                        {a.category ?? "—"}
                        {a.vendor ? ` · ${a.vendor}` : ""}
                        {" · "}bought {a.purchaseDate}
                      </div>
                    </TableCell>
                    <TableCell>
                      {a.event ? (
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <EventMark name={a.event.name} size="xs" />
                          {a.event.name}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right num">{money(a.purchasePriceDollars)}</TableCell>
                    <TableCell className="text-right num text-muted-foreground">
                      {a.usefulLifeMonths ? `${a.usefulLifeMonths}mo` : "—"}
                    </TableCell>
                    <TableCell className="text-right num">{money(a.netBookValueDollars)}</TableCell>
                    <TableCell>
                      <Badge variant={a.status === "IN_SERVICE" ? "success" : a.status === "SOLD" ? "muted" : "destructive"}>
                        {STATUS_LABEL[a.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <EditAssetButton asset={a} events={events} />
                        <DeleteButton
                          action={deleteCapitalAssetAction.bind(null, a.id)}
                          itemLabel="capital asset"
                          itemName={a.name}
                          confirmText={`This removes "${a.name}" (${money(a.purchasePriceDollars)}) from your equipment list.`}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </TableOnDesktop>

            <MobileList className="p-3">
              {assets.map((a) => (
                <MobileRow
                  key={a.id}
                  title={a.name}
                  subtitle={[a.category, a.vendor].filter(Boolean).join(" · ") || undefined}
                  meta={money(a.purchasePriceDollars)}
                  badges={
                    <>
                      <Badge variant={a.status === "IN_SERVICE" ? "success" : a.status === "SOLD" ? "muted" : "destructive"}>
                        {STATUS_LABEL[a.status]}
                      </Badge>
                      {a.event && (
                        <Badge variant="muted">
                          <EventMark name={a.event.name} size="xs" />
                          {a.event.name}
                        </Badge>
                      )}
                      <span className="ml-auto flex items-center gap-1">
                        <EditAssetButton asset={a} events={events} />
                      </span>
                    </>
                  }
                >
                  <MobileField label="Net book" value={money(a.netBookValueDollars)} />
                  <MobileField label="Life" value={a.usefulLifeMonths ? `${a.usefulLifeMonths} mo` : "—"} />
                  <MobileField label="Bought" value={a.purchaseDate} />
                </MobileRow>
              ))}
              {assets.length === 0 && <MobileEmpty>No capital equipment yet.</MobileEmpty>}
            </MobileList>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <div className="text-2xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 num text-base font-semibold">{value}</div>
      <div className="text-2xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function NewAssetButton({ events }: { events: Event[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="brand"><Plus className="h-3.5 w-3.5" /> Add equipment</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add capital equipment</DialogTitle></DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              try {
                await createCapitalAssetAction(fd);
                toast({ title: "Equipment added" });
                setOpen(false);
                router.refresh();
              } catch (err: any) {
                toast({ title: "Failed", description: String(err?.message ?? err), variant: "destructive" });
              }
            });
          }}
          className="grid gap-3"
        >
          <AssetFields events={events} defaults={{ purchaseDate: today }} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}{pending ? "Saving..." : "Add equipment"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditAssetButton({ asset, events }: { asset: Asset; events: Event[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon-sm" variant="ghost" aria-label={`Edit ${asset.name}`}>
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit {asset.name}</DialogTitle></DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              try {
                await updateCapitalAssetAction(asset.id, fd);
                toast({ title: "Equipment updated" });
                setOpen(false);
                router.refresh();
              } catch (err: any) {
                toast({ title: "Failed", description: String(err?.message ?? err), variant: "destructive" });
              }
            });
          }}
          className="grid gap-3"
        >
          <AssetFields events={events} defaults={asset} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AssetFields({ events, defaults }: { events: Event[]; defaults: Partial<Asset> }) {
  return (
    <>
      <div className="grid gap-1.5">
        <Label htmlFor="cap-name">Equipment name</Label>
        <Input id="cap-name" name="name" required autoFocus defaultValue={defaults.name ?? ""} placeholder="Hot holding unit · Tea dispenser · …" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="cap-cat">Category</Label>
          <Select name="category" defaultValue={defaults.category ?? CAPITAL_CATEGORIES[0]}>
            <SelectTrigger id="cap-cat"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CAPITAL_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cap-vendor">Vendor (optional)</Label>
          <Input id="cap-vendor" name="vendor" defaultValue={defaults.vendor ?? ""} placeholder="Amazon · Restaurant Depot · …" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="cap-date">Purchase date</Label>
          <Input id="cap-date" name="purchaseDate" type="date" required defaultValue={defaults.purchaseDate ?? ""} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cap-price">Purchase price ($)</Label>
          <Input
            id="cap-price"
            name="purchasePriceDollars"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={defaults.purchasePriceDollars?.toString() ?? ""}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="cap-life">Useful life (months)</Label>
          <Input
            id="cap-life"
            name="usefulLifeMonths"
            type="number"
            min="0"
            placeholder="60 = 5 years"
            defaultValue={defaults.usefulLifeMonths?.toString() ?? ""}
          />
          <span className="text-2xs text-muted-foreground">Leave blank if you don&apos;t want to depreciate.</span>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cap-salvage">Salvage value ($)</Label>
          <Input
            id="cap-salvage"
            name="salvageValueDollars"
            type="number"
            step="0.01"
            min="0"
            defaultValue={(defaults.salvageValueDollars ?? 0).toString()}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="cap-status">Status</Label>
          <Select name="status" defaultValue={defaults.status ?? "IN_SERVICE"}>
            <SelectTrigger id="cap-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="IN_SERVICE">In service</SelectItem>
              <SelectItem value="SOLD">Sold</SelectItem>
              <SelectItem value="WRITTEN_OFF">Written off</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {events.length > 0 && (
          <div className="grid gap-1.5">
            <Label htmlFor="cap-event">Event (optional)</Label>
            <Select name="eventId" defaultValue={defaults.event?.id ?? "none"}>
              <SelectTrigger id="cap-event"><SelectValue placeholder="No event" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No event</SelectItem>
                {events.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    <span className="inline-flex items-center gap-2">
                      <EventMark name={e.name} size="xs" />
                      {e.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="cap-notes">Notes (optional)</Label>
        <Textarea id="cap-notes" name="notes" rows={2} defaultValue={defaults.notes ?? ""} placeholder="Serial #, warranty, where it lives…" />
      </div>
    </>
  );
}
