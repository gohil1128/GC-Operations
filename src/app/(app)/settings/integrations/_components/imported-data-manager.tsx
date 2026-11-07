"use client";
import { EventMark } from "@/components/event-mark";
import * as React from "react";
import { formatMoney } from "@/lib/money";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle, Database, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import {
  deleteImportedDayAction,
  deleteImportedEventDataAction,
  deleteAllImportedAction,
} from "@/modules/imports/actions";

type Day = {
  iso: string;
  label: string;
  netSalesDollars: number;
  guestCount: number;
  itemCount: number;
  itemQty: number;
  source: string;
  event: { id: string; name: string; color: string | null } | null;
};

type EventGroup = { id: string; name: string; color: string | null; days: number; netDollars: number };

// Shared formatter so thousands separators match the rest of the app.
const money = (n: number) => formatMoney(Math.round(n * 100));

export function ImportedDataManager({
  days,
  eventGroups,
}: {
  days: Day[];
  eventGroups: EventGroup[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState<
    | { kind: "day"; iso: string; label: string }
    | { kind: "event"; id: string; name: string }
    | { kind: "all" }
    | null
  >(null);

  const run = async (fn: () => Promise<{ salesDeleted: number; itemsDeleted: number }>, key: string) => {
    setBusy(key);
    try {
      const res = await fn();
      toast({
        title: "Deleted",
        description: `${res.salesDeleted} day record${res.salesDeleted === 1 ? "" : "s"} · ${res.itemsDeleted} item rollup${res.itemsDeleted === 1 ? "" : "s"} removed`,
      });
      setConfirm(null);
      router.refresh();
    } catch (err: any) {
      toast({ title: "Delete failed", description: String(err?.message ?? err), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const [showAllGroups, setShowAllGroups] = React.useState(false);
  const totalNet = days.reduce((a, d) => a + d.netSalesDollars, 0);

  return (
    <div className="space-y-4">
      {/* By event: a quiet list, first five shown. Each row deletes that event's imported days. */}
      {eventGroups.length > 0 && (
        <div>
          <h4 className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">By event</h4>
          <ul className="divide-y divide-border-soft overflow-hidden rounded-2xl bg-muted/40">
            {(showAllGroups ? eventGroups : eventGroups.slice(0, 5)).map((g) => (
              <li key={g.id} className="flex items-center gap-2.5 py-1.5 pl-3 pr-1.5">
                <EventMark name={g.name} size="xs" />
                <span className="min-w-0 flex-1 truncate text-sm">{g.name}</span>
                <span className="num shrink-0 text-2xs text-muted-foreground">{g.days}d · {money(g.netDollars)}</span>
                <button
                  type="button"
                  onClick={() => setConfirm({ kind: "event", id: g.id, name: g.name })}
                  disabled={busy !== null}
                  aria-label={`Delete imported days for ${g.name}`}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
          {eventGroups.length > 5 && (
            <button type="button" onClick={() => setShowAllGroups((v) => !v)} className="mt-1.5 px-1 text-xs font-medium text-brand-ink">
              {showAllGroups ? "Show fewer" : `Show all ${eventGroups.length}`}
            </button>
          )}
        </div>
      )}

      {days.length === 0 ? (
        <div className="rounded-xl border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          <Database className="mx-auto mb-2 h-7 w-7 text-muted-foreground/40" />
          No imported sales data yet. Upload a CSV above to get started.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-2xs text-muted-foreground">
              {days.length} imported day{days.length === 1 ? "" : "s"} · {money(totalNet)} total net sales
            </p>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive border-destructive/40 hover:bg-destructive/10"
              disabled={busy !== null}
              onClick={() => setConfirm({ kind: "all" })}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete everything
            </Button>
          </div>

          {/* Phone: one card per day, so a date never wraps in a squeezed column. */}
          <div className="max-h-[min(70vh,560px)] divide-y divide-border-soft overflow-y-auto overscroll-contain rounded-2xl bg-muted/40 lg:hidden">
            {days.map((d) => (
              <div key={d.iso} className="flex items-center gap-2.5 py-2 pl-3 pr-1.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <span className="text-sm font-semibold">{d.label}</span>
                    <span className="num text-sm font-semibold">{money(d.netSalesDollars)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-muted-foreground">
                    {d.event ? (
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <EventMark name={d.event.name} size="xs" />
                        {d.event.name}
                      </span>
                    ) : (
                      <span>No event</span>
                    )}
                    <span>{d.guestCount} txns{d.itemCount > 0 ? ` · ${d.itemCount} items` : ""}</span>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 shrink-0 rounded-full"
                  disabled={busy !== null}
                  onClick={() => setConfirm({ kind: "day", iso: d.iso, label: d.label })}
                  aria-label={`Delete ${d.label}`}
                >
                  {busy === `day:${d.iso}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />}
                </Button>
              </div>
            ))}
          </div>

          <div className="hidden rounded-xl border overflow-hidden lg:block lg:max-h-[min(60vh,420px)] lg:overflow-y-auto lg:overscroll-contain">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead className="text-right">Txns</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {days.map((d) => (
                  <TableRow key={d.iso}>
                    <TableCell className="font-medium">{d.label}</TableCell>
                    <TableCell>
                      {d.event ? (
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <EventMark name={d.event.name} size="xs" />
                          {d.event.name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right num">{money(d.netSalesDollars)}</TableCell>
                    <TableCell className="text-right num text-muted-foreground">{d.guestCount}</TableCell>
                    <TableCell className="text-right num text-muted-foreground">
                      {d.itemCount > 0 ? `${d.itemCount} (${d.itemQty.toLocaleString()})` : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={busy !== null}
                        onClick={() => setConfirm({ kind: "day", iso: d.iso, label: d.label })}
                        aria-label={`Delete ${d.label}`}
                      >
                        {busy === `day:${d.iso}` ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {confirm?.kind === "all" ? "Delete ALL imported data?"
                : confirm?.kind === "event" ? `Delete "${confirm.name}" data?`
                : "Delete this day?"}
            </DialogTitle>
            <DialogDescription>
              {confirm?.kind === "all"
                ? "This permanently removes every imported sales day and item rollup at this location. You'll re-import from your CSVs. This cannot be undone."
                : confirm?.kind === "event"
                  ? "This removes all imported sales days and item rollups tagged with this event at this location. The event itself stays. This cannot be undone."
                  : confirm?.kind === "day"
                    ? `This removes the sales totals and item rollups for ${confirm.label}. This cannot be undone.`
                    : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirm(null)} disabled={busy !== null}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={busy !== null}
              onClick={() => {
                if (!confirm) return;
                if (confirm.kind === "day") run(() => deleteImportedDayAction(confirm.iso), `day:${confirm.iso}`);
                else if (confirm.kind === "event") run(() => deleteImportedEventDataAction(confirm.id), `event:${confirm.id}`);
                else run(() => deleteAllImportedAction(), "all");
              }}
            >
              {busy !== null ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
