import { TableCell } from "@/components/ui/table";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

/*
  One block of the event page. Every section carries its own count and subtotal
  in the heading, so the page can be skimmed without opening anything, and an
  optional `note` for the sections whose numbers are derived rather than tagged.
*/
export function EventSection({
  title,
  count,
  subtitle,
  note,
  empty,
  children,
}: {
  title: string;
  /** Row count shown as a chip; pass null for sections that aren't a list. */
  count: number | null;
  subtitle?: string;
  note?: string;
  /** Shown instead of `children` when count is 0. */
  empty?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bento overflow-hidden">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border px-4 py-3.5 sm:px-5">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          {title}
          {count !== null && (
            <span className="num rounded-full bg-beige px-2 py-0.5 text-2xs font-semibold text-secondary-foreground">
              {count.toLocaleString()}
            </span>
          )}
        </h2>
        {subtitle && <span className="num text-[13px] text-muted-foreground">{subtitle}</span>}
      </header>
      {note && (
        <p className="border-b border-border bg-beige/50 px-4 py-2 text-xs text-secondary-foreground sm:px-5">
          {note}
        </p>
      )}
      <div className={cn(count === 0 ? "px-4 py-6 sm:px-5" : "p-2 sm:p-3")}>
        {count === 0 ? (
          <p className="text-sm text-muted-foreground">{empty ?? "Nothing recorded."}</p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

/** Right-aligned money cell — the shape repeated across every table here. */
export function Money({ children, muted }: { children: number; muted?: boolean }) {
  return (
    <TableCell className={cn("num text-right", muted && "text-muted-foreground")}>
      {formatMoney(children)}
    </TableCell>
  );
}

/** Right-aligned plain number cell. */
export function Num({ children }: { children: number }) {
  return <TableCell className="num text-right">{children.toLocaleString()}</TableCell>;
}
