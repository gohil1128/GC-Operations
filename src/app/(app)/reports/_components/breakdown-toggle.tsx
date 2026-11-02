"use client";
import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/*
  A "Full breakdown" that folds away.

  Not a <details>. A closed <details> prints closed in most browsers, and this
  page has a Print button: a P&L on paper with every event's breakdown folded
  shut would be a stack of headlines. The region carries `print-show`, which the
  print stylesheet forces open.

  The summary line is always visible, so the card reads on its own; this only
  holds the ten-row detail for when someone wants it.
*/
export function BreakdownToggle({
  children,
  label = "Full breakdown",
  className,
}: {
  children: React.ReactNode;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-full px-1 text-sm font-medium opacity-80 hover:opacity-100"
      >
        {label}
        <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")} aria-hidden />
      </button>
      <div id={id} hidden={!open} className="print-show">
        {children}
      </div>
    </div>
  );
}
