"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateBusinessAction } from "@/modules/admin/actions";
import { toast } from "@/components/ui/use-toast";

/*
  A short list rather than the full IANA set: the full list is ~600 entries and
  unusable in a select, and a food business trades in one place. Anything not
  here is still accepted by the server, and a value already set is kept as an
  option so saving the form never silently changes it.
*/
const TIMEZONES = [
  "America/St_Johns", "America/Halifax", "America/Toronto", "America/Winnipeg",
  "America/Regina", "America/Edmonton", "America/Vancouver",
  "America/New_York", "America/Chicago", "America/Denver", "America/Phoenix",
  "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu",
  "Europe/London", "Europe/Dublin", "Europe/Paris", "Europe/Berlin",
  "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Asia/Tokyo",
  "Australia/Perth", "Australia/Sydney", "Pacific/Auckland", "UTC",
];

type Props = {
  initial: {
    name: string;
    timezone: string;
    foodTargetPct: number;
    laborTargetPct: number;
    ebitdaMultiplier: number;
    revenueMultiplier: number;
  };
};

export function BusinessForm({ initial }: Props) {
  const [pending, start] = React.useTransition();
  const router = useRouter();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          try {
            await updateBusinessAction(fd);
            toast({ title: "Business updated" });
            router.refresh();
          } catch (err: any) {
            toast({ title: "Failed", description: String(err?.message ?? err), variant: "destructive" });
          }
        });
      }}
      className="grid gap-3"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="biz-name">Business name</Label>
        <Input id="biz-name" name="name" required defaultValue={initial.name} />
      </div>
      {/*
        The zone the business trades in, not the one the server runs in. Every
        business day — which close a payout belongs to, which day "today" means
        when you open a new close — is worked out from this. It was fixed at
        America/New_York and never read, so a stall trading in Vancouver or
        Auckland would have had its evening takings filed under tomorrow.
      */}
      <div className="grid gap-1.5">
        <Label htmlFor="biz-tz">Timezone</Label>
        <select
          id="biz-tz"
          name="timezone"
          defaultValue={initial.timezone}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace(/_/g, " ")}
            </option>
          ))}
          {!TIMEZONES.includes(initial.timezone) && (
            <option value={initial.timezone}>{initial.timezone.replace(/_/g, " ")}</option>
          )}
        </select>
        <span className="text-2xs text-muted-foreground">
          Decides which day a cash close belongs to. Set this to where you actually trade.
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="biz-food">Food cost target (%)</Label>
          <Input id="biz-food" name="foodTargetPct" type="number" min="0" max="100" defaultValue={initial.foodTargetPct} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="biz-labor">Labor cost target (%)</Label>
          <Input id="biz-labor" name="laborTargetPct" type="number" min="0" max="100" defaultValue={initial.laborTargetPct} />
        </div>
      </div>
      <div className="border-t pt-3 mt-1">
        <div className="text-2xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
          Valuation multipliers
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="biz-ebitda-mult">EBITDA × multiple</Label>
            <Input id="biz-ebitda-mult" name="ebitdaMultiplier" type="number" min="0" step="0.1" defaultValue={initial.ebitdaMultiplier} />
            <span className="text-2xs text-muted-foreground">Applied when EBITDA &gt; 0. Typical: 3–6× for food businesses.</span>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="biz-rev-mult">Revenue × multiple</Label>
            <Input id="biz-rev-mult" name="revenueMultiplier" type="number" min="0" step="0.1" defaultValue={initial.revenueMultiplier} />
            <span className="text-2xs text-muted-foreground">Fallback when EBITDA ≤ 0. Typical: 1–2× of revenue.</span>
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving..." : "Save"}</Button>
      </div>
    </form>
  );
}
