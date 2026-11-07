"use client";
import { EventMark } from "@/components/event-mark";
import * as React from "react";
import { formatMoney } from "@/lib/money";
import { useRouter } from "next/navigation";
import { Plus, Calendar, Trash2, AlertTriangle, Loader2, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { createEventAction, updateEventAction, deleteEventAction } from "@/modules/events/actions";
import { toast } from "@/components/ui/use-toast";

type Ev = {
  id: string; name: string; color: string | null;
  startDate: string; endDate: string; isActive: boolean;
  feeCents: number; feeNote: string; notes: string;
};

// Shared formatter so thousands separators match the rest of the app.
const money = (cents: number) => formatMoney(cents);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// "2026-10-24" → "Oct 24, 2026"; a span → "Oct 24 – Oct 25, 2026" (year only once when shared).
function formatRange(start: string, end: string) {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  if (!sy || !ey) return `${start} → ${end}`;
  const a = `${MONTHS[sm - 1]} ${sd}`;
  const b = `${MONTHS[em - 1]} ${ed}`;
  if (start === end) return `${a}, ${sy}`;
  return sy === ey ? `${a} – ${b}, ${sy}` : `${a}, ${sy} – ${b}, ${ey}`;
}

// Presets for a new event's colour. The colour shows up all over the app — the
// chart legend, the P&L column, the invoice dot — so the first one is the
// default for every event anybody creates, and it has to be seen on both
// themes. The old default was espresso #3A2415, which is a brown-black dot on
// a near-black page: almost every event had a colour nobody could see. The
// marigold leads now; every swatch is also drawn with a hairline ring, so even a
// colour that happens to match the surface it sits on still reads.
const PALETTE = [
  "#F2A93C", // marigold — the brand's own
  "#FF7A66", // coral
  "#F5BD1C", // yellow
  "#C4623A", // rust
  "#3F8FB8", // blue
  "#8D9191", // grey
];

export function EventsManager({ events }: { events: Ev[] }) {
  return (
    <div className="space-y-3">
      <div className="divide-y divide-border-soft overflow-hidden rounded-2xl bg-muted/40">
        {events.map((e) => {
          return (
            <div key={e.id} className="flex items-center gap-3 py-2.5 pl-3 pr-1.5">
              <EventMark name={e.name} size="md" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium leading-snug">{e.name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-2xs text-muted-foreground">
                  <span>{formatRange(e.startDate, e.endDate)}</span>
                  {e.feeCents > 0 && <span>· Fee {money(e.feeCents)}</span>}
                  {!e.isActive && <span>· Inactive</span>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <EditEventButton event={e} />
                <TwoStepDeleteEventButton event={e} />
              </div>
            </div>
          );
        })}
        {events.length === 0 && (
          <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
            <Calendar className="h-4 w-4 mx-auto mb-1 opacity-50" />
            No events yet. Create one to tag days and analyze performance.
          </div>
        )}
      </div>
      <NewEventButton />
    </div>
  );
}

function NewEventButton() {
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [color, setColor] = React.useState(PALETTE[0]);
  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setColor(PALETTE[0]); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full"><Plus className="h-3.5 w-3.5" /> Add event</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New event</DialogTitle></DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("color", color);
            start(async () => {
              try {
                await createEventAction(fd);
                toast({ title: "Event created" });
                setOpen(false);
                router.refresh();
              } catch (err: any) { toast({ title: "Failed", description: String(err?.message ?? err), variant: "destructive" }); }
            });
          }}
          className="grid gap-3"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="ev-name">Event name</Label>
            <Input id="ev-name" name="name" required placeholder="e.g. Bollywood Night, Summer Fest" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ev-start">Start date</Label>
              <Input id="ev-start" name="startDate" type="date" required defaultValue={today} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ev-end">End date</Label>
              <Input id="ev-end" name="endDate" type="date" required defaultValue={today} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Color</Label>
            <div className="flex gap-1.5 flex-wrap">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full border-2 ${color === c ? "border-foreground" : "border-foreground/25"}`}
                  style={{ backgroundColor: c }}
                  aria-label={`Pick ${c}`}
                />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-[1fr_2fr] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ev-fee">Event fee ($)</Label>
              <Input id="ev-fee" name="feeDollars" type="number" step="0.01" min="0" defaultValue="0" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ev-fee-note">Fee note (optional)</Label>
              <Input id="ev-fee-note" name="feeNote" placeholder="Booth rental · vendor permit · entry fee…" />
            </div>
          </div>
          <p className="text-2xs text-muted-foreground -mt-1">
            Paid upfront to participate (booth fee, vendor permit, etc.). Counts as an event-scoped operating expense.
          </p>
          <div className="grid gap-1.5">
            <Label htmlFor="ev-notes">Notes (optional)</Label>
            <Textarea id="ev-notes" name="notes" rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Create event"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Two-stage confirmation: first a plain "are you sure", then a hard warning
// that types out exactly what gets deleted (sales + item sales) vs preserved
// (invoices + cash closes). The operator must confirm twice to proceed.
function TwoStepDeleteEventButton({ event }: { event: Ev }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<1 | 2>(1);
  const [pending, start] = React.useTransition();

  const reset = () => { setStep(1); };

  const onConfirm = () => {
    if (step === 1) { setStep(2); return; }
    start(async () => {
      try {
        await deleteEventAction(event.id);
        toast({ title: "Event deleted", description: `"${event.name}" and its sales data were removed. Invoices were kept.` });
        setOpen(false);
        setStep(1);
        router.refresh();
      } catch (err: any) {
        toast({ title: "Delete failed", description: String(err?.message ?? err), variant: "destructive" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full" aria-label={`Delete ${event.name}`}>
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        {step === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Delete &quot;{event.name}&quot;?
              </DialogTitle>
              <DialogDescription>
                You&apos;re about to delete this event. The next screen will confirm exactly what gets removed.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="outline" onClick={onConfirm}>Continue</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Last warning — this cannot be undone
              </DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-3 pt-1">
                  <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                    <div className="font-medium text-destructive mb-1">Will be permanently deleted:</div>
                    <ul className="list-disc list-inside text-foreground/80 space-y-0.5">
                      <li>All <strong>daily sales</strong> tagged to &quot;{event.name}&quot;</li>
                      <li>All <strong>per-item sales</strong> tagged to &quot;{event.name}&quot;</li>
                    </ul>
                  </div>
                  <div className="rounded-lg border border-success/40 bg-success/5 p-3 text-sm">
                    <div className="font-medium text-success mb-1">Will be kept (just untagged):</div>
                    <ul className="list-disc list-inside text-foreground/80 space-y-0.5">
                      <li>All <strong>invoices</strong></li>
                      <li>All <strong>cash closes</strong></li>
                    </ul>
                  </div>
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setStep(1); }} disabled={pending}>Back</Button>
              <Button variant="destructive" onClick={onConfirm} disabled={pending}>
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete event &amp; its sales
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditEventButton({ event }: { event: Ev }) {
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const router = useRouter();
  const [color, setColor] = React.useState(event.color ?? PALETTE[0]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full" aria-label={`Edit ${event.name}`}><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit event</DialogTitle></DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("color", color);
            start(async () => {
              try {
                await updateEventAction(event.id, fd);
                toast({ title: "Event updated" });
                setOpen(false);
                router.refresh();
              } catch (err: any) { toast({ title: "Failed", description: String(err?.message ?? err), variant: "destructive" }); }
            });
          }}
          className="grid gap-3"
        >
          <div className="grid gap-1.5">
            <Label htmlFor={`name-${event.id}`}>Name</Label>
            <Input id={`name-${event.id}`} name="name" required defaultValue={event.name} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Start date</Label>
              <Input name="startDate" type="date" required defaultValue={event.startDate} />
            </div>
            <div className="grid gap-1.5">
              <Label>End date</Label>
              <Input name="endDate" type="date" required defaultValue={event.endDate} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Color</Label>
            <div className="flex gap-1.5 flex-wrap">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full border-2 ${color === c ? "border-foreground" : "border-foreground/25"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-[1fr_2fr] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor={`fee-${event.id}`}>Event fee ($)</Label>
              <Input
                id={`fee-${event.id}`}
                name="feeDollars"
                type="number"
                step="0.01"
                min="0"
                defaultValue={(event.feeCents / 100).toFixed(2)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`feenote-${event.id}`}>Fee note (optional)</Label>
              <Input
                id={`feenote-${event.id}`}
                name="feeNote"
                defaultValue={event.feeNote}
                placeholder="Booth rental · vendor permit · entry fee…"
              />
            </div>
          </div>
          <p className="text-2xs text-muted-foreground -mt-1">
            Booth / vendor / entry fee paid upfront. Counts as an event-scoped operating expense.
          </p>
          <div className="grid gap-1.5">
            <Label>Notes</Label>
            <Textarea name="notes" rows={2} defaultValue={event.notes} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" value="true" defaultChecked={event.isActive} />
            <span>Active</span>
          </label>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
