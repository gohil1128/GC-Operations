"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, MapPin, Check, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DeleteButton } from "@/components/delete-button";
import { createLocationAction, updateLocationAction, deleteLocationAction } from "@/modules/locations/actions";
import { toast } from "@/components/ui/use-toast";

type Loc = { id: string; name: string; kind: "STORE" | "EVENT"; address: string | null };

export function LocationsManager({
  locations,
  activeLocationId,
  canDelete,
}: {
  locations: Loc[];
  activeLocationId: string;
  canDelete: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {locations.map((l) => (
          <div key={l.id} className="flex items-start gap-3 rounded-2xl border border-border-soft bg-muted/40 p-3">
            <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-muted text-brand-ink">
              <MapPin className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-semibold leading-snug break-words">{l.name}</span>
                {l.id === activeLocationId && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-muted px-2 py-0.5 text-2xs font-medium text-success">
                    <Check className="h-3 w-3" aria-hidden /> Active
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Badge variant="muted" className="text-2xs">{l.kind}</Badge>
                {l.address && <span className="text-2xs text-muted-foreground break-words">{l.address}</span>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <EditLocationButton location={l} />
              <DeleteButton
                action={() => deleteLocationAction(l.id)}
                itemLabel="location"
                className="h-9 w-9 rounded-full bg-card"
                itemName={l.name}
                confirmText={`This will permanently delete "${l.name}" and ALL data tied to it (sales, shifts, cash closes, counts, POs). Anything not tied to a location — like ingredients, recipes, suppliers, employees — stays.`}
              />
            </div>
          </div>
        ))}
      </div>
      {!canDelete && (
        <p className="text-2xs text-muted-foreground">You must keep at least one location.</p>
      )}
      <NewLocationButton />
    </div>
  );
}

function NewLocationButton() {
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full"><Plus className="h-3.5 w-3.5" /> Add location</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New location</DialogTitle></DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              try {
                await createLocationAction(fd);
                toast({ title: "Location added" });
                setOpen(false);
                router.refresh();
              } catch (err: any) {
                toast({ title: "Failed", description: String(err?.message ?? err), variant: "destructive" });
              }
            });
          }}
          className="grid gap-3"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required placeholder="e.g. Main Street Cafe" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="kind">Type</Label>
            <Select name="kind" defaultValue="STORE">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="STORE">Store (fixed location)</SelectItem>
                <SelectItem value="EVENT">Event / Pop-up</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="address">Address (optional)</Label>
            <Input id="address" name="address" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Add location"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditLocationButton({ location }: { location: Loc }) {
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full bg-card" aria-label={`Edit ${location.name}`}><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit location</DialogTitle></DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              try {
                await updateLocationAction(location.id, fd);
                toast({ title: "Location updated" });
                setOpen(false);
                router.refresh();
              } catch (err: any) {
                toast({ title: "Failed", description: String(err?.message ?? err), variant: "destructive" });
              }
            });
          }}
          className="grid gap-3"
        >
          <div className="grid gap-1.5">
            <Label htmlFor={`name-${location.id}`}>Name</Label>
            <Input id={`name-${location.id}`} name="name" required defaultValue={location.name} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`kind-${location.id}`}>Type</Label>
            <Select name="kind" defaultValue={location.kind}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="STORE">Store (fixed location)</SelectItem>
                <SelectItem value="EVENT">Event / Pop-up</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`address-${location.id}`}>Address</Label>
            <Input id={`address-${location.id}`} name="address" defaultValue={location.address ?? ""} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
