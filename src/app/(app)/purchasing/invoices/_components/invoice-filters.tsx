"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X, SlidersHorizontal, ChevronDown } from "lucide-react";
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

  // On a phone the filters sit behind one button so the invoices are the first
  // thing on screen; from md up they are always open.
  const [open, setOpen] = React.useState(false);
  return (
    <div>
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-expanded={open}
      className="lg-press flex h-11 w-full items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium md:hidden"
    >
      <SlidersHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden />
      Filters
      {activeCount > 0 && <span className="num rounded-full bg-highlight px-2 text-xs font-semibold text-highlight-foreground">{activeCount}</span>}
      <ChevronDown className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
    </button>
    {/* Two columns on a phone, with Supplier across both; every field the same
        height and top-aligned, so labels line up whatever sits beside them. */}
    <form onSubmit={apply} className={`bento grid-cols-2 items-start gap-x-3 gap-y-3 p-4 [&>div]:min-w-0 md:grid md:grid-cols-5 ${open ? "mt-2 grid" : "hidden"}`}>
      <div className="col-span-2 grid gap-1.5 md:col-span-1">
        <Label className="text-xs">Supplier</Label>
        <Select value={supplierId} onValueChange={setSupplierId}>
          <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All suppliers</SelectItem>
            {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs">Event</Label>
        <Select value={eventId} onValueChange={setEventId}>
          <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            {events.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs">Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="f-from" className="text-xs">From</Label>
        <Input id="f-from" type="date"
             className="h-10 w-full min-w-0 max-w-full appearance-none px-3 text-[13px] [&::-webkit-date-and-time-value]:text-left [&::-webkit-calendar-picker-indicator]:ml-0" value={from} onChange={(e) => setFrom(e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="f-to" className="text-xs">To</Label>
        <Input id="f-to" type="date"
             className="h-10 w-full min-w-0 max-w-full appearance-none px-3 text-[13px] [&::-webkit-date-and-time-value]:text-left [&::-webkit-calendar-picker-indicator]:ml-0" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <div className="col-span-2 flex justify-end gap-2 pt-1 md:col-span-5">
        {activeCount > 0 && (
          <Button type="button" size="sm" variant="ghost" onClick={clear}>
            <X /> Clear ({activeCount})
          </Button>
        )}
        <Button type="submit" size="sm">Apply filters</Button>
      </div>
    </form>
    </div>
  );
}
