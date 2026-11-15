import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/*
  Wide data tables are unreadable on a phone — sideways scrolling hides the
  columns that matter. These primitives let a screen show its table on desktop
  and a quiet list on mobile, from the same data.

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

/*
  The phone counterpart of a table: a quiet list, not a stack of cards.

  It used to be one bordered card per record, each with a ruled-off grid of
  LABEL / value pairs under it. Five invoices filled two screens and every
  record shouted equally. Now a record is two or three lines of text: what it
  is and what it is worth on the first, when and what state on the second, and
  its details as one soft run beneath. Rows are separated by an inset hairline
  only, so a list reads as one surface whether it sits on a card or the page.
*/
export function MobileList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col lg:hidden [&>*+*]:border-t [&>*+*]:border-border-soft/50", className)}>
      {children}
    </div>
  );
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
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0 truncate text-[15px] font-medium leading-snug">{title}</div>
        <div className="flex shrink-0 items-center gap-1">
          {meta && <div className="num text-[15px] font-medium tabular-nums">{meta}</div>}
          {href && <ChevronRight aria-hidden className="h-3.5 w-3.5 translate-y-px text-muted-foreground/70" />}
        </div>
      </div>

      {(subtitle || badges) && (
        <div className="mt-0.5 flex items-center justify-between gap-3">
          <div className="min-w-0 truncate text-xs text-muted-foreground">{subtitle}</div>
          {badges && <div className="flex shrink-0 flex-wrap items-center justify-end gap-1 [&>*]:px-2 [&>*]:py-0 [&>*]:text-[10.5px]">{badges}</div>}
        </div>
      )}

      {children && <dl className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">{children}</dl>}
    </>
  );

  const cls = cn("touch-target block px-1 py-3 text-left", href && !actions && "rounded-xl active:bg-muted/60", className);
  const foot = actions && <div className="mt-1 flex items-center justify-end gap-1 [&_button]:h-8 [&_button]:gap-1 [&_button]:bg-transparent [&_button]:px-2.5 [&_button]:text-xs [&_button]:shadow-none [&_svg]:h-3.5 [&_svg]:w-3.5">{actions}</div>;
  if (href && !actions) return <Link href={href} className={cls}>{body}</Link>;
  // Actions are buttons, which cannot live inside a link, so the link is the body alone.
  if (href) return <div className={cls}><Link href={href} className="block">{body}</Link>{foot}</div>;
  return <div className={cls}>{body}{foot}</div>;
}

/** One label/value pair in a MobileRow's detail line: "Lines 8". */
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
    <div className={cn("flex min-w-0 max-w-full items-baseline gap-1", className)}>
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="num min-w-0 truncate text-foreground/80">{value}</dd>
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
