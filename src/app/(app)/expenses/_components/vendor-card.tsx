"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Sparkles, Check, Globe2, BadgeDollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DeleteButton } from "@/components/delete-button";
import {
  createVendorAction, updateVendorAction, deleteVendorAction,
  payVendorAction, logIncentiveAction,
} from "@/modules/vendors/actions";
import { toast } from "@/components/ui/use-toast";
import { formatMoney, fromCents, APP_LOCALE } from "@/lib/money";

type Vendor = {
  id: string;
  name: string;
  role: string | null;
  country: string | null;
  monthlyFeeCents: number;
  currency: string;
  defaultCategory: string;
  isFlatFee: boolean;
  notes: string | null;
  isActive: boolean;
};

type Payment = { paid: boolean; amountCents: number };

const CATEGORIES = [
  { value: "CONTRACTOR", label: "Contractor / Freelancer" },
  { value: "MARKETING", label: "Marketing" },
  { value: "ADMIN", label: "Admin / Office" },
  { value: "OTHER", label: "Other" },
];

// CAD first: it is the app's own currency and the one almost every
// subscription here is billed in. The rest are for the occasional US or
// overseas supplier, whose code is shown beside the amount.
const CURRENCIES = ["CAD", "USD", "GBP", "EUR", "INR", "AUD"];

export function VendorsSection({
  vendors, payments, yearMonth,
}: {
  vendors: Vendor[];
  payments: Record<string, Payment>;
  yearMonth: string;
}) {
  const monthlyFixedTotal = vendors
    .filter((v) => v.isActive)
    .reduce((a, v) => a + v.monthlyFeeCents, 0);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0 gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            Vendors &amp; contractors
            {monthlyFixedTotal > 0 && (
              <Badge variant="brand" className="font-semibold">
                {formatMoney(monthlyFixedTotal)} / mo fixed
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Recurring service providers (designer, accountant, agencies). One click to record this month&apos;s payment
            or log a performance incentive.
          </CardDescription>
        </div>
        <NewVendorButton />
      </CardHeader>
      <CardContent className="space-y-2">
        {vendors.length === 0 && (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No vendors yet. Add your graphic designer, accountant, or any other recurring service provider.
          </div>
        )}
        {vendors.map((v) => (
          <VendorRow key={v.id} vendor={v} payment={payments[v.id] ?? { paid: false, amountCents: 0 }} yearMonth={yearMonth} />
        ))}
      </CardContent>
    </Card>
  );
}

function VendorRow({ vendor, payment, yearMonth }: { vendor: Vendor; payment: Payment; yearMonth: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${vendor.isActive ? "" : "opacity-60"}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{vendor.name}</span>
          {vendor.role && <span className="text-xs text-muted-foreground">· {vendor.role}</span>}
          {!vendor.isActive && <Badge variant="muted">Inactive</Badge>}
          {payment.paid && <Badge variant="success" className="gap-1"><Check className="h-3 w-3" /> Paid this month</Badge>}
        </div>
        <div className="flex items-center gap-3 text-2xs text-muted-foreground mt-0.5">
          {vendor.country && <span className="inline-flex items-center gap-1"><Globe2 className="h-3 w-3" /> {vendor.country}</span>}
          <span className="inline-flex items-center gap-1"><BadgeDollarSign className="h-3 w-3" /> {formatMoney(vendor.monthlyFeeCents)} {vendor.currency} / mo</span>
          {vendor.isFlatFee && <span>· Flat fee, no tax</span>}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <PayThisMonthButton vendor={vendor} yearMonth={yearMonth} alreadyPaid={payment.paid} />
        <IncentiveButton vendor={vendor} />
        <EditVendorButton vendor={vendor} />
        <DeleteButton
          action={() => deleteVendorAction(vendor.id)}
          itemLabel="vendor"
          itemName={vendor.name}
          confirmText={`Remove "${vendor.name}" from your vendor list? Past payments stay in the expense history but lose the vendor tag.`}
        />
      </div>
    </div>
  );
}

function NewVendorButton() {
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const router = useRouter();
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        await createVendorAction(fd);
        toast({ title: "Vendor added" });
        setOpen(false);
        router.refresh();
      } catch (err: any) {
        toast({ title: "Failed", description: String(err?.message ?? err), variant: "destructive" });
      }
    });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="brand"><Plus className="h-3.5 w-3.5" /> Add vendor</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add a vendor</DialogTitle></DialogHeader>
        <VendorForm onSubmit={submit} pending={pending} onCancel={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function EditVendorButton({ vendor }: { vendor: Vendor }) {
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const router = useRouter();
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        await updateVendorAction(vendor.id, fd);
        toast({ title: "Vendor updated" });
        setOpen(false);
        router.refresh();
      } catch (err: any) {
        toast({ title: "Failed", description: String(err?.message ?? err), variant: "destructive" });
      }
    });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Edit vendor"><Pencil className="h-3.5 w-3.5" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit vendor</DialogTitle></DialogHeader>
        <VendorForm onSubmit={submit} pending={pending} onCancel={() => setOpen(false)} initial={vendor} />
      </DialogContent>
    </Dialog>
  );
}

function VendorForm({
  onSubmit, pending, onCancel, initial,
}: {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  pending: boolean;
  onCancel: () => void;
  initial?: Vendor;
}) {
  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="vd-name">Name</Label>
          <Input id="vd-name" name="name" required defaultValue={initial?.name} placeholder="e.g. Priya Designs" autoFocus />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="vd-role">Role</Label>
          <Input id="vd-role" name="role" defaultValue={initial?.role ?? ""} placeholder="Graphic Designer" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="vd-country">Country</Label>
          <Input id="vd-country" name="country" defaultValue={initial?.country ?? ""} placeholder="India" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="vd-fee">Monthly fee</Label>
          <div className="flex gap-1.5">
            <Input id="vd-fee" name="monthlyFeeDollars" type="number" step="0.01" min="0" required
              defaultValue={initial ? fromCents(initial.monthlyFeeCents).toString() : "0"} className="flex-1" />
            <Select name="currency" defaultValue={initial?.currency ?? "CAD"}>
              <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="vd-cat">Default expense category</Label>
        <Select name="defaultCategory" defaultValue={initial?.defaultCategory ?? "CONTRACTOR"}>
          <SelectTrigger id="vd-cat"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-2xs text-muted-foreground">Payments + incentives to this vendor will flow into this category.</span>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isFlatFee" value="true" defaultChecked={initial?.isFlatFee ?? true} />
        <span>Flat fee · no tax / withholding (typical for overseas contractors)</span>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" value="true" defaultChecked={initial?.isActive ?? true} />
        <span>Active</span>
      </label>
      <div className="grid gap-1.5">
        <Label htmlFor="vd-notes">Notes</Label>
        <Textarea id="vd-notes" name="notes" rows={2} defaultValue={initial?.notes ?? ""} placeholder="Payment method, contract terms..." />
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="brand" disabled={pending}>{pending ? "Saving..." : "Save vendor"}</Button>
      </DialogFooter>
    </form>
  );
}

function PayThisMonthButton({ vendor, yearMonth, alreadyPaid }: { vendor: Vendor; yearMonth: string; alreadyPaid: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const router = useRouter();
  const today = new Date();
  const defaultDate = `${yearMonth}-${String(today.getDate()).padStart(2, "0")}`;
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("vendorId", vendor.id);
    start(async () => {
      try {
        await payVendorAction(fd);
        toast({ title: `${vendor.name} paid` });
        setOpen(false);
        router.refresh();
      } catch (err: any) {
        toast({ title: "Failed", description: String(err?.message ?? err), variant: "destructive" });
      }
    });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={alreadyPaid ? "outline" : "default"}>
          {alreadyPaid ? "Pay again" : "Pay this month"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pay {vendor.name}</DialogTitle>
          <DialogDescription>Records an expense in the {vendor.defaultCategory.toLowerCase()} category for this vendor.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="pay-date">Payment date</Label>
              <Input id="pay-date" name="businessDate" type="date" required defaultValue={defaultDate} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pay-amount">Amount ({vendor.currency})</Label>
              <Input id="pay-amount" name="amountDollars" type="number" step="0.01" min="0.01" required
                defaultValue={fromCents(vendor.monthlyFeeCents).toString()} autoFocus />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pay-desc">Note (optional)</Label>
            <Input id="pay-desc" name="description" placeholder={`e.g. ${new Date().toLocaleString(APP_LOCALE, { month: "long" })} retainer`} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Recording..." : "Record payment"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function IncentiveButton({ vendor }: { vendor: Vendor }) {
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("vendorId", vendor.id);
    start(async () => {
      try {
        await logIncentiveAction(fd);
        toast({ title: "Incentive logged" });
        setOpen(false);
        router.refresh();
      } catch (err: any) {
        toast({ title: "Failed", description: String(err?.message ?? err), variant: "destructive" });
      }
    });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-warning" /> Incentive
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log a performance incentive</DialogTitle>
          <DialogDescription>
            Reward {vendor.name} for a high-performing post or campaign. Recorded as an expense and surfaced separately
            from the monthly fee.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="inc-date">Date</Label>
              <Input id="inc-date" name="businessDate" type="date" required defaultValue={today} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="inc-amount">Amount ({vendor.currency})</Label>
              <Input id="inc-amount" name="amountDollars" type="number" step="0.01" min="0.01" required autoFocus />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="inc-perf">What performed well?</Label>
            <Input id="inc-perf" name="performanceNote" placeholder="e.g. Reel hit 100K views" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="inc-desc">Description (optional)</Label>
            <Input id="inc-desc" name="description" placeholder="Internal note" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="brand" disabled={pending}>{pending ? "Saving..." : "Log incentive"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
