"use client";
import * as React from "react";
import { Droplets } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/*
  How much glass this person wants.

  Apple shipped the same control, and shipped it for the same reason: the
  material drew real legibility criticism, and across the 26 releases they
  added a Clear/Tinted choice in Display & Brightness, then a Lock Screen
  intensity slider, then Reduce Bright Effects. "Tune the transparency
  correctly" turned out not to be an answer anyone could give for every
  backdrop at once, because there is no such setting — a translucent surface
  over an unknown background can only guarantee contrast by being less
  translucent.

  There is also a plainly practical reason. The CSS that is supposed to carry
  this — prefers-reduced-transparency — is not implemented in Safari or
  Firefox. Honouring only that media query means the setting works for nobody
  on the platform this is modelled on, while the code reads as though
  accessibility had been handled. This is the part that actually works
  everywhere.

  Three settings, not a slider, because the useful distinctions are few:
  the material as designed, a frostier one that obscures more, and none.

  Stored per device rather than per business. It is a statement about this
  screen and these eyes — a sunlit stall tablet and an office monitor want
  different answers from the same account.
*/

export const GLASS_DENSITY_KEY = "lg-density";

export type GlassDensity = "regular" | "reduced" | "solid";

const OPTIONS: { value: GlassDensity; label: string; blurb: string }[] = [
  { value: "regular", label: "Regular", blurb: "The material as designed — translucent, with the backdrop showing through." },
  { value: "reduced", label: "Frosted", blurb: "Denser. Keeps the depth, obscures more of what is behind it." },
  { value: "solid", label: "Solid", blurb: "No transparency at all. Highest contrast, and the fastest to draw." },
];

export function GlassDensityCard() {
  const [value, setValue] = React.useState<GlassDensity>("regular");

  // Read after mount: the server has no localStorage, so deciding this during
  // render would disagree with the markup it sent.
  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(GLASS_DENSITY_KEY) as GlassDensity | null;
      if (stored === "regular" || stored === "reduced" || stored === "solid") setValue(stored);
    } catch {
      /* private browsing — the default stands */
    }
  }, []);

  const choose = (next: GlassDensity) => {
    setValue(next);
    document.documentElement.dataset.lgDensity = next;
    try {
      window.localStorage.setItem(GLASS_DENSITY_KEY, next);
    } catch {
      /* the choice still applies to this page view */
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Droplets className="h-4 w-4 text-muted-foreground" aria-hidden />
          Transparency
        </CardTitle>
        <CardDescription>How much shows through the floating panels · this device only</CardDescription>
      </CardHeader>
      <CardContent>
        <fieldset className="space-y-2.5">
          <legend className="sr-only">Transparency of the floating panels</legend>
          {OPTIONS.map((o) => (
            <label key={o.value} className="touch-target flex items-start gap-2.5 text-sm">
              <input
                type="radio"
                name="lg-density"
                className="mt-0.5 h-4 w-4 accent-[hsl(var(--espresso))]"
                checked={value === o.value}
                onChange={() => choose(o.value)}
              />
              <span>
                <span className="font-medium">{o.label}</span>
                <span className="block text-2xs text-muted-foreground">{o.blurb}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <p className="mt-3 border-t pt-3 text-2xs leading-relaxed text-muted-foreground">
          If your system is set to reduce transparency, that is honoured on its own and this is
          already off — but only two of the four major browsers implement that setting, which is
          why this exists as well.
        </p>
      </CardContent>
    </Card>
  );
}

/*
  Applied before the first paint.

  As an effect this would run after the page has already been painted with the
  full material, so anyone who asked for Solid would watch the glass appear and
  then be taken away on every single navigation. Inline and synchronous in the
  document head is the only place this can go.
*/
export function GlassDensityScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `(function(){try{var v=localStorage.getItem(${JSON.stringify(GLASS_DENSITY_KEY)});if(v==="reduced"||v==="solid"){document.documentElement.dataset.lgDensity=v}}catch(e){}})();`,
      }}
    />
  );
}
