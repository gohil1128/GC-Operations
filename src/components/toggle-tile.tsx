import * as React from "react";
import { cn } from "@/lib/utils";

/*
  One setting, one tile: a title (and optional detail) on the left, a switch on
  the right, the whole tile tappable. Replaces the bare checkbox rows that read
  as a list of things. It is still a real checkbox underneath, so keyboard and
  screen-reader behaviour is unchanged.
*/
export function ToggleTile({
  checked, onChange, title, detail, aside, className,
}: {
  checked: boolean;
  onChange: () => void;
  title: React.ReactNode;
  detail?: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "lg-press flex min-h-[56px] cursor-pointer items-center gap-3 rounded-2xl border px-4 py-2.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50",
        checked ? "border-brand/40 bg-brand-muted/60" : "border-border-soft bg-muted/50",
        className,
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-snug">{title}</span>
        {detail && <span className="mt-0.5 block text-2xs leading-snug text-muted-foreground">{detail}</span>}
      </span>
      {aside && <span className="shrink-0 text-2xs text-muted-foreground">{aside}</span>}
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={onChange} />
      <span
        aria-hidden
        className="relative h-6 w-10 shrink-0 rounded-full bg-border transition-colors peer-checked:bg-highlight after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-card after:shadow-sm after:transition-transform peer-checked:after:translate-x-4 peer-checked:after:bg-highlight-foreground"
      />
    </label>
  );
}
