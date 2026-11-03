"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft } from "lucide-react";
import type { Role } from "@prisma/client";
import { ROLE_LABELS } from "@/lib/permissions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { reassignUserRecordsAction } from "@/modules/users/actions";

type Person = { id: string; name: string; email: string; role: Role };
export type ReassignableCounts = {
  purchaseOrders: number;
  invoices: number;
  expenses: number;
  capitalAssets: number;
  cashClosesClosed: number;
  cashClosesVerified: number;
  inventoryCounts: number;
};

/*
  Moves everything one person created onto another. This is what actually
  clears the path to deleting a departed owner or manager — the records
  themselves stay required to point at a real person (that's what "who did
  this" reporting reads), so an account with a history has to be handed off
  rather than erased.
*/
export function ReassignCard({
  fromUser,
  counts,
  others,
}: {
  fromUser: { id: string; name: string };
  counts: ReassignableCounts;
  others: Person[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [toId, setToId] = React.useState(others[0]?.id ?? "");
  const [pending, start] = React.useTransition();

  const total =
    counts.purchaseOrders + counts.invoices + counts.expenses + counts.capitalAssets +
    counts.cashClosesClosed + counts.cashClosesVerified + counts.inventoryCounts;

  const lines = [
    { label: "Invoices", n: counts.invoices },
    { label: "Purchase orders", n: counts.purchaseOrders },
    { label: "Expenses", n: counts.expenses },
    { label: "Capital purchases", n: counts.capitalAssets },
    { label: "Cash closes (closed)", n: counts.cashClosesClosed },
    { label: "Cash closes (verified)", n: counts.cashClosesVerified },
    { label: "Inventory counts", n: counts.inventoryCounts },
  ].filter((l) => l.n > 0);

  if (others.length === 0) {
    return (
      <div className="bento p-4 text-sm text-muted-foreground sm:p-5">
        Nothing to reassign to yet — invite another team member first.
      </div>
    );
  }

  const target = others.find((o) => o.id === toId);

  const run = () =>
    start(async () => {
      const res = await reassignUserRecordsAction(fromUser.id, toId);
      if ("error" in res) {
        toast({ title: "Reassign failed", description: res.error, variant: "destructive" });
        return;
      }
      const moved = Object.values(res.counts).reduce((a, n) => a + n, 0);
      toast({
        title: moved > 0 ? `Moved ${moved} record${moved === 1 ? "" : "s"} to ${target?.name}` : "Nothing to move",
      });
      setOpen(false);
      router.refresh();
    });

  return (
    <div className="bento p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Reassign records</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {total === 0
              ? `${fromUser.name} has nothing tied to their account — they can be deleted directly.`
              : `Move everything ${fromUser.name} created — ${total} record${total === 1 ? "" : "s"} — onto another team member.`}
          </p>
        </div>
      </div>

      {total > 0 && (
        <div className="mt-4 flex flex-wrap items-end gap-2.5">
          <div className="grid min-w-[220px] gap-1">
            <Label className="text-xs">Move to</Label>
            <Select value={toId} onValueChange={setToId}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {others.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name} · {ROLE_LABELS[o.role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" size="sm" onClick={() => setOpen(true)} disabled={!toId}>
            <ArrowRightLeft className="h-3.5 w-3.5" /> Reassign
          </Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign {fromUser.name}&rsquo;s records?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Every record below moves to <span className="font-semibold text-foreground">{target?.name}</span>.
                  This changes who created them — the amounts, dates and everything else stay exactly the same.
                </p>
                <ul className="num rounded-lg border border-border bg-muted/30 p-2.5 text-xs">
                  {lines.map((l) => (
                    <li key={l.label} className="flex items-center justify-between py-0.5">
                      <span>{l.label}</span>
                      <span className="font-medium">{l.n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button type="button" onClick={run} disabled={pending}>
              {pending ? "Reassigning…" : `Move ${total} record${total === 1 ? "" : "s"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
