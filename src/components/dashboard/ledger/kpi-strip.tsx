import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/*
  The v3 KPI tile: four separate tiles on the surface tint, each an icon circle
  beside a label, a figure and an optional delta chip.

  It used to be one ruled band with four cells divided by hairlines. The change
  is not only visual: the old band put the figure at 42px with the comparison
  in grey underneath, so "how are we doing" was a sentence you had to read. v3
  puts the direction in a coloured chip next to the number, which is the part
  people actually scan for, and drops the figure to 24px to make room for it.

  The chip carries a glyph as well as a colour — ▲ and ▼ — so direction does
  not depend on telling green from red.
*/

export type KpiDelta = {
  /** The chip's text, e.g. "12.4%" or "9 open". */
  text: string;
  /** up/down colour the movement; alert is rust for "piling up", not an error. */
  tone: "up" | "down" | "alert" | "flat";
};

export type Kpi = {
  label: string;
  value: string;
  sub: React.ReactNode;
  icon: LucideIcon;
  delta?: KpiDelta | null;
};

const CHIP = {
  up: "bg-success-muted text-success",
  down: "bg-destructive-muted text-destructive",
  alert: "bg-alert-muted text-alert",
  flat: "bg-card text-muted-foreground",
} as const;

const GLYPH = { up: "▲ ", down: "▼ ", alert: "", flat: "" } as const;

export function KpiStrip({ items }: { items: Kpi[] }) {
  return (
    <div className="mt-[18px] grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((k) => {
        const Icon = k.icon;
        return (
          <div key={k.label} className="flex items-start gap-3.5 rounded-2xl bg-muted px-[18px] py-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-card">
              <Icon className="h-[18px] w-[18px] text-espresso" aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="text-[12.5px] text-muted-foreground">{k.label}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="display-num text-2xl font-medium tabular-nums tracking-[-0.02em]">
                  {k.value}
                </span>
                {k.delta && (
                  <span
                    className={cn(
                      "rounded-full px-[7px] py-0.5 text-[11px] font-semibold",
                      CHIP[k.delta.tone],
                    )}
                  >
                    {GLYPH[k.delta.tone]}
                    {k.delta.text}
                  </span>
                )}
              </div>
              <div className="mt-[3px] text-[11px] text-muted-foreground">{k.sub}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
