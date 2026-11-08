"use client";
import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Fold } from "@/components/fold";

/*
  One event as one line: the summary is the button, the breakdown folds out
  under it. Same print rule as BreakdownToggle: the region carries print-show,
  so a printed P&L has every breakdown open.
*/
export function PnlRow({ summary, children }: { summary: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();
  return (
    <li className="min-w-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="lg-press flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
      >
        {summary}
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")} aria-hidden />
      </button>
      <Fold id={id} open={open}>
        <div className="px-4 pb-3">{children}</div>
      </Fold>
    </li>
  );
}
