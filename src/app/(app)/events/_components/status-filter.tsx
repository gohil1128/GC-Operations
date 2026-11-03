"use client";
import Link from "next/link";
import { Check, ChevronsUpDown, ListFilter } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/*
  Which events to show, as one control that opens a list on a phone.

  Five labelled chips with counts wrapped onto two rows at phone width, with
  the odd one stranded on a line of its own and a tall gap underneath. A single
  dropdown says what is selected and keeps the list one tap away; from `lg` up
  there is room for the chips, so the page shows those instead.
*/
export type StatusOption = { key: string; label: string; href: string; count: number; active: boolean };

export function StatusFilter({ options }: { options: StatusOption[] }) {
  const current = options.find((o) => o.active) ?? options[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Showing ${current.label}. Change which events are shown`}
          className="lg-press flex min-h-11 w-full items-center gap-2.5 rounded-full border border-border bg-card px-4 text-left text-sm hover:bg-muted sm:w-auto sm:min-w-64 lg:hidden"
        >
          <ListFilter aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate font-medium">{current.label}</span>
          <span className="num text-xs text-muted-foreground">{current.count}</span>
          <ChevronsUpDown aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-64">
        {options.map((o) => (
          <DropdownMenuItem key={o.key} asChild>
            <Link href={o.href} aria-current={o.active ? "true" : undefined} className={cn("gap-2.5", o.count === 0 && !o.active && "opacity-60")}>
              <span className={cn("min-w-0 flex-1 truncate", o.active && "font-semibold")}>{o.label}</span>
              <span className="num shrink-0 text-xs text-muted-foreground">{o.count}</span>
              {o.active ? <Check aria-hidden className="h-3.5 w-3.5 shrink-0 text-brand-ink" /> : <span aria-hidden className="w-3.5 shrink-0" />}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
