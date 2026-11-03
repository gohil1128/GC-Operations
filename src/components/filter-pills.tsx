import Link from "next/link";
import { cn } from "@/lib/utils";

// Pill filter row — a segmented set of links where the selected one is the
// dark espresso pill. Used on the list screens (invoices, inventory, items).
export type FilterPill = { href: string; label: string; active?: boolean; tone?: "default" | "danger" };

export function FilterPills({ pills, className }: { pills: FilterPill[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {pills.map((p) => (
        <Link
          key={p.href + p.label}
          href={p.href}
          className={cn(
            "rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors",
            p.active
              ? "border-highlight bg-highlight text-highlight-foreground"
              : p.tone === "danger"
                ? "border-destructive/30 bg-card text-destructive hover:bg-destructive-muted"
                : "border-border bg-card text-secondary-foreground hover:bg-accent",
          )}
        >
          {p.label}
        </Link>
      ))}
    </div>
  );
}
