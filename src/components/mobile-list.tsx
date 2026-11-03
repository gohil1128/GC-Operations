import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/*
  Wide data tables are unreadable on a phone — sideways scrolling hides the
  columns that matter. These primitives let a screen show its table on desktop
  and a stacked card list on mobile, from the same data.

  Usage:
    <TableOnDesktop>  ...existing <Table> ...  </TableOnDesktop>
    <MobileList>
      {rows.map(r => (
        <MobileRow key={r.id} href={...} title={...} meta={...} badges={...}>
          <MobileField label="Total" value={...} />
        </MobileRow>
      ))}
    </MobileList>
*/

/** Hides the full table below `md`, where it would only scroll sideways. */
export function TableOnDesktop({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("hidden lg:block", className)}>{children}</div>;
}

/** The mobile counterpart — a stack of cards, hidden from `md` up. */
export function MobileList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-2.5 lg:hidden", className)}>{children}</div>;
}

export function MobileRow({
  href,
  title,
  subtitle,
  meta,
  badges,
  actions,
  children,
  className,
}: {
  href?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Right-aligned headline value, usually money. */
  meta?: React.ReactNode;
  badges?: React.ReactNode;
  /** Row actions (re-open, delete…), set apart on their own line at the foot. */
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold leading-tight">{title}</div>
          {subtitle && <div className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {meta && <div className="display-num text-[17px] font-medium">{meta}</div>}
          {href && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {badges && <div className="mt-2 flex flex-wrap items-center gap-1.5">{badges}</div>}

      {children && (
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border pt-3">{children}</dl>
      )}
    </>
  );

  const cls = cn("touch-target bento block p-4 text-left", href && !actions && "active:bg-accent/60", className);
  const foot = actions && <div className="mt-2 flex items-center justify-end gap-1.5">{actions}</div>;
  if (href && !actions) return <Link href={href} className={cls}>{body}</Link>;
  // Actions are buttons, which cannot live inside a link, so the link is the body alone.
  if (href) return <div className={cls}><Link href={href} className="block">{body}</Link>{foot}</div>;
  return <div className={cls}>{body}{foot}</div>;
}

/** One label/value pair inside a MobileRow's detail grid. */
export function MobileField({
  label,
  value,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-2xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-[13px] font-medium num">{value}</dd>
    </div>
  );
}

/** Shared empty state so every converted screen reads the same. */
export function MobileEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="bento p-8 text-center text-sm text-muted-foreground lg:hidden">{children}</div>
  );
}

/**
 * One empty state for the whole app. The audit found five different treatments
 * (radius, padding, icon, container all drifting), so this is the single shape.
 * Pass `filtered` when the emptiness is caused by a filter rather than by there
 * being no data at all — the copy and the action differ.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bento p-10 text-center", className)}>
      {icon && (
        <span className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-full bg-accent text-muted-foreground">
          {icon}
        </span>
      )}
      <div className="text-sm font-semibold">{title}</div>
      {description && (
        <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
