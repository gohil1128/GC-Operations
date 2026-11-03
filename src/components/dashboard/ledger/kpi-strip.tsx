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

export function KpiStrip({ items, className }: { items: Kpi[]; className?: string }) {
  return (
    <div className={cn("mt-[18px] grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {items.map((k) => {
        const Icon = k.icon;
        return (
          /*
            Compact on a phone: three across, the icon dropped, the figure a
            size down. Stacked full-width they took ~420px of scroll to show
            three numbers, and pushed the event cards — the part of this page
            most specific to the business — off the first two screens.
          */
          <div
            key={k.label}
            className="flex min-w-0 flex-col gap-1 rounded-3xl bg-card px-3 py-3.5 sm:flex-row sm:items-start sm:gap-3.5 sm:px-[18px] sm:py-4"
          >
            <span className="hidden h-10 w-10 shrink-0 place-items-center rounded-full bg-muted sm:grid">
              <Icon className="h-[18px] w-[18px] text-foreground" aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="truncate text-[11.5px] text-muted-foreground sm:text-[12.5px]">{k.label}</div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  className="display-num truncate text-[19px] font-medium tabular-nums tracking-[-0.02em] sm:text-2xl"
                  title={k.value}
                >
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
              <div className="mt-[3px] line-clamp-2 text-[11px] text-muted-foreground">{k.sub}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
