"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Supplier = { id: string; name: string };
type EventOption = { id: string; name: string };

export function InvoiceFilters({
  suppliers,
  events,
  initialEventId,
}: {
  suppliers: Supplier[];
  events: EventOption[];
  /** The page's already-resolved event filter ("all" or a real id) — not
   *  read from the URL directly, because it can come from the header
   *  switcher's cookie instead, which this component can't see for itself. */
  initialEventId: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const [supplierId, setSupplierId] = React.useState(sp.get("supplier") ?? "all");
  const [eventId, setEventId] = React.useState(initialEventId);
  const [status, setStatus] = React.useState(sp.get("status") ?? "all");
  const [from, setFrom] = React.useState(sp.get("from") ?? "");
  const [to, setTo] = React.useState(sp.get("to") ?? "");

  const apply = (e?: React.FormEvent) => {
    e?.preventDefault();
    const params = new URLSearchParams();
    if (supplierId && supplierId !== "all") params.set("supplier", supplierId);
    // Always written, unlike the other fields: "no param" means "defer to the
    // header's active-event cookie", so submitting this form has to say
    // "all" outright to actually mean "every event" when a cookie is active.
    params.set("event", eventId);
    if (status && status !== "all") params.set("status", status);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    router.push(qs ? `/purchasing/invoices?${qs}` : "/purchasing/invoices");
  };

  const clear = () => {
    setSupplierId("all"); setEventId("all"); setStatus("all"); setFrom(""); setTo("");
    router.push("/purchasing/invoices");
  };

  const activeCount =
    (supplierId !== "all" ? 1 : 0) +
    (eventId !== "all" ? 1 : 0) +
    (status !== "all" ? 1 : 0) +
    (from ? 1 : 0) +
    (to ? 1 : 0);

  return (
    <form onSubmit={apply} className="bento grid grid-cols-2 items-end gap-2 bg-muted/20 p-3 [&>div]:min-w-0 md:grid-cols-5">
      <div className="grid gap-1">
        <Label className="text-xs">Supplier</Label>
        <Select value={supplierId} onValueChange={setSupplierId}>
          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All suppliers</SelectItem>
            {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">Event</Label>
        <Select value={eventId} onValueChange={setEventId}>
          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            {events.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1">
        <Label htmlFor="f-from" className="text-xs">From</Label>
        <Input id="f-from" type="date"
             className="w-full min-w-0 h-8" value={from} onChange={(e) => setFrom(e.target.value)} />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="f-to" className="text-xs">To</Label>
        <Input id="f-to" type="date"
             className="w-full min-w-0 h-8" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <div className="col-span-2 md:col-span-5 flex justify-end gap-2 pt-1">
        {activeCount > 0 && (
          <Button type="button" size="sm" variant="ghost" onClick={clear}>
            <X className="h-3.5 w-3.5" /> Clear ({activeCount})
          </Button>
        )}
        <Button type="submit" size="sm">Apply filters</Button>
      </div>
    </form>
  );
}
