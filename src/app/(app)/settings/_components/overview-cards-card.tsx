"use client";
import * as React from "react";
import { LayoutDashboard } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { setHiddenOverviewCardsAction } from "@/modules/admin/actions";
import { OVERVIEW_CARDS } from "@/modules/dashboard/cards";
import { toast } from "@/components/ui/use-toast";

/*
  Which cards this business wants on its Overview.

  Ticked means shown, which is the way round people read a list of things they
  have. The column stores the hidden ones, so this inverts on the way in and out
  — worth the small awkwardness here to get the storage right, because a card
  added later then appears for everybody instead of staying invisible until each
  business goes looking for it.
*/
export function OverviewCardsCard({ hidden }: { hidden: string[] }) {
  const [off, setOff] = React.useState<string[]>(hidden);

  /*
    The latest choice, held in a ref as well as state.

    Ticking three boxes quickly fires three saves, and each one sends the WHOLE
    list. Read from state, the second and third would compute their list from a
    value React had not re-rendered yet and would undo the tick before them.
    The ref is current immediately, so the last save to leave carries every
    change made up to that moment.
  */
  const latest = React.useRef<string[]>(hidden);

  // Server state wins on a real navigation.
  React.useEffect(() => {
    setOff(hidden);
    latest.current = hidden;
  }, [hidden]);

  const toggle = (key: string) => {
    const previous = latest.current;
    const next = previous.includes(key)
      ? previous.filter((k) => k !== key)
      : [...previous, key];

    // Optimistic, and deliberately NOT wrapped in a transition with a disabled
    // fieldset. That combination left each checkbox dead for a second or two
    // after every click — long enough that a person ticking three in a row
    // loses the second and third, which is exactly how this was found.
    latest.current = next;
    setOff(next);

    void (async () => {
      const res = await setHiddenOverviewCardsAction(next);
      if (res && "error" in res) {
        latest.current = previous;
        setOff(previous); // put it back rather than leave the UI lying
        toast({ title: res.error, variant: "destructive" });
      }
    })();
  };

  const shownCount = OVERVIEW_CARDS.length - off.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayoutDashboard className="h-4 w-4 text-muted-foreground" aria-hidden />
          Overview cards
        </CardTitle>
        <CardDescription>
          {shownCount} of {OVERVIEW_CARDS.length} shown · applies to everyone in this business
        </CardDescription>
      </CardHeader>
      <CardContent>
        <fieldset className="space-y-2.5">
          <legend className="sr-only">Cards to show on the Overview</legend>
          {OVERVIEW_CARDS.map((c) => (
            <label key={c.key} className="touch-target flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-[hsl(var(--espresso))]"
                checked={!off.includes(c.key)}
                onChange={() => toggle(c.key)}
              />
              <span>
                <span className="font-medium">{c.label}</span>
                <span className="block text-2xs text-muted-foreground">{c.blurb}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <p className="mt-3 border-t pt-3 text-2xs text-muted-foreground">
          Hiding a card only changes what the Overview shows. Nothing is deleted, and every
          figure is still on its own page.
        </p>
      </CardContent>
    </Card>
  );
}
