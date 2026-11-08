"use client";
import * as React from "react";
import { Package } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { setPremixCostAction } from "@/modules/admin/actions";

/* What a bag of premix costs to make in house. The Home premix card's profit is
   its sales less this amount for every bag sold. */
export function PremixCostCard({ costCents }: { costCents: number }) {
  const [value, setValue] = React.useState((costCents / 100).toFixed(2));
  const [pending, start] = React.useTransition();
  React.useEffect(() => setValue((costCents / 100).toFixed(2)), [costCents]);
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await setPremixCostAction(Number(value));
      if (res && "error" in res) toast({ title: res.error, variant: "destructive" });
      else toast({ title: "Premix cost saved" });
    });
  };
  return (
    <Card id="premix-cost" data-settings-section>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" aria-hidden /> Premix cost
        </CardTitle>
        <CardDescription>What a bag costs you to make in house</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="flex items-end gap-3">
          <div className="grid flex-1 gap-1.5">
            <Label htmlFor="premix-cost-input">Cost per bag ($)</Label>
            <Input id="premix-cost-input" type="number" inputMode="decimal" step="0.01" min="0" max="100" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        </form>
        <p className="mt-3 text-2xs leading-relaxed text-muted-foreground">
          The Premix card on Home shows profit as sales minus this cost for every bag sold, across all events.
        </p>
      </CardContent>
    </Card>
  );
}
