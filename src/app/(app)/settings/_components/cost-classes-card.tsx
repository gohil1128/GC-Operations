"use client";
import * as React from "react";
import { Scale } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { setOpexInvoiceCategoriesAction } from "@/modules/admin/actions";
import { CLASSIFIABLE_INVOICE_CATEGORIES } from "@/modules/reports/cost-classes";
import { toast } from "@/components/ui/use-toast";

/*
  Where each kind of supplier bill lands on the P&L.

  Ticked means cost of goods, because that is the side the question is really
  about: does this bill belong to the drink, or to the day? The column stores
  the other side — the operating expenses — so that a category nobody has an
  opinion about stays in cost of goods, which is where every invoice used to
  go. That asymmetry is the whole point and is explained in cost-classes.ts.

  Same optimistic, ref-backed pattern as the Overview cards control next to
  it: each tick sends the whole list, so reading the list from state would let
  a quick second tick undo the first.
*/
export function CostClassesCard({ opex }: { opex: string[] }) {
  const [off, setOff] = React.useState<string[]>(opex);
  const latest = React.useRef<string[]>(opex);

  React.useEffect(() => {
    setOff(opex);
    latest.current = opex;
  }, [opex]);

  const toggle = (category: string) => {
    const previous = latest.current;
    const next = previous.includes(category)
      ? previous.filter((c) => c !== category)
      : [...previous, category];

    latest.current = next;
    setOff(next);

    void (async () => {
      const res = await setOpexInvoiceCategoriesAction(next);
      if (res && "error" in res) {
        latest.current = previous;
        setOff(previous);
        toast({ title: res.error, variant: "destructive" });
      }
    })();
  };

  const cogsCount = CLASSIFIABLE_INVOICE_CATEGORIES.length - off.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-muted-foreground" aria-hidden />
          Cost of goods
        </CardTitle>
        <CardDescription>
          {cogsCount} of {CLASSIFIABLE_INVOICE_CATEGORIES.length} categories counted against gross
          margin
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-2xs leading-relaxed text-muted-foreground">
          Gross margin only means anything if what is subtracted from sales was consumed making
          them. Tick the bills that belong to the product; leave the rest, and they are counted
          below the gross-profit line as a cost of being open.
        </p>
        <fieldset className="space-y-2.5">
          <legend className="sr-only">Invoice categories counted as cost of goods</legend>
          {CLASSIFIABLE_INVOICE_CATEGORIES.map((c) => (
            <label key={c} className="touch-target flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[hsl(var(--espresso))]"
                checked={!off.includes(c)}
                onChange={() => toggle(c)}
              />
              <span className="font-medium">{c}</span>
              <span className="ml-auto text-2xs text-muted-foreground">
                {off.includes(c) ? "Operating expense" : "Cost of goods"}
              </span>
            </label>
          ))}
        </fieldset>
        <p className="mt-3 border-t pt-3 text-2xs leading-relaxed text-muted-foreground">
          An invoice with no category, or one in a category you made up, counts as cost of goods
          — the same as before there was a choice here. Nothing is deleted either way; this only
          decides which side of the gross-profit line a bill is printed on.
        </p>
      </CardContent>
    </Card>
  );
}
