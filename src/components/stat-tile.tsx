import { cn } from "@/lib/utils";

// The 4-across stat row used on every list screen. `dark` is the screen's one
// espresso card; `amber` is the attention/CTA tile.
export function StatTile({
  label,
  value,
  meta,
  action,
  variant = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  variant?: "default" | "dark" | "amber";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-1 rounded-bento border px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-5 sm:py-4",
        variant === "dark" && "border-espresso bg-espresso text-espresso-foreground",
        variant === "amber" && "border-warning/25 bg-warning-muted text-warning",
        variant === "default" && "border-border bg-card",
        className,
      )}
    >
      {/* flex-1 so the figure gets the room first. Both halves used to shrink
          equally, which let a wordy meta squeeze the value until it truncated
          — and a dollar amount rendered as "$17,7…" is worse than useless. */}
      <div className="min-w-0 max-w-full sm:flex-1">
        <div className={cn("text-xs", variant === "default" ? "text-muted-foreground" : "opacity-75")}>
          {label}
        </div>
        <div
          className={cn(
            "display-num mt-0.5 truncate text-[20px] font-medium sm:text-[28px]",
            variant === "dark" && "text-amber",
          )}
        >
          {value}
        </div>
      </div>
      {action ?? (
        meta && (
          <span className={cn("min-w-0 max-w-full truncate text-xs sm:shrink sm:max-w-[45%] sm:text-right", variant === "default" ? "text-muted-foreground" : "opacity-80")}>
            {meta}
          </span>
        )
      )}
    </div>
  );
}

export function StatTileRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-2.5 sm:gap-3.5 xl:grid-cols-4", className)}>{children}</div>;
}
