"use client";
import * as React from "react";
import Link from "next/link";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { EventOption } from "@/modules/dashboard/event-scope";
import { setActiveEventAction } from "@/modules/events/actions";

/*
  Picks which event a screen is about — what used to be a date-range control.

  A menu rather than a segmented pill row: the season's events grow without
  bound, and four segments that quietly stop showing the fifth event would be
  worse than a list. Every entry is a real link, so the choice survives a
  reload, a bookmark and the back button.
*/
export function EventControl({
  events,
  activeKey,
  activeLabel,
  basePath,
}: {
  events: EventOption[];
  activeKey: string;
  activeLabel: string;
  basePath: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="glass-pill touch-target inline-flex max-w-[15rem] items-center gap-2 rounded-full px-3.5 py-1.5 text-xs text-secondary-foreground"
        >
          <CalendarDays className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
          <span className="truncate font-semibold text-foreground">{activeLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
          <span className="sr-only">Change which event this screen shows</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[60vh] w-64 overflow-y-auto">
        <DropdownMenuLabel className="normal-case tracking-normal">Show</DropdownMenuLabel>
        <Row href={`${basePath}?event=all`} eventId={null} label="All events" active={activeKey === "all"} />
        {events.length > 0 && <DropdownMenuSeparator />}
        {events.map((e) => (
          <Row
            key={e.id}
            href={`${basePath}?event=${e.id}`}
            eventId={e.id}
            label={e.name}
            color={e.color}
            active={activeKey === e.id}
          />
        ))}
        {events.length === 0 && (
          <p className="px-2 py-2 text-2xs text-muted-foreground">
            No events yet. Add one in Settings to scope these numbers to it.
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/*
  ONE event scope, not two.

  The header's event switcher stores its choice in a cookie, and every
  event-scoped screen reads that cookie. This menu stored its choice only in
  the URL. Both offer exactly the same options — all events, or one event —
  so the Overview showed two "All events" controls that could quietly
  disagree: pick Garba here, open Invoices, and you were back on whatever the
  header had last been set to.

  So a pick here is written to the same cookie as well. The link still
  carries ?event=, which is what this page renders from and what keeps the
  choice in a bookmark and on the back button — the cookie is only for the
  screens you go to next, so it is fired alongside the navigation rather than
  awaited in front of it. Somebody without the events capability cannot set
  the scope; for them the write is refused and swallowed, and the menu
  behaves exactly as it did before.
*/
function Row({
  href,
  eventId,
  label,
  color,
  active,
}: {
  href: string;
  eventId: string | null;
  label: string;
  color?: string | null;
  active: boolean;
}) {
  return (
    <DropdownMenuItem asChild>
      <Link
        href={href}
        onClick={() => void setActiveEventAction(eventId).catch(() => {})}
        aria-current={active ? "true" : undefined}
        className="gap-2"
      >
        {color !== undefined ? (
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-[2px]"
            style={{ background: color ?? "hsl(var(--ink-400))" }}
          />
        ) : (
          <span aria-hidden className="h-2 w-2 shrink-0" />
        )}
        <span className={cn("min-w-0 flex-1 truncate", active && "font-semibold")}>{label}</span>
        {active && <Check className="h-3.5 w-3.5 shrink-0 text-brand-ink" aria-hidden />}
      </Link>
    </DropdownMenuItem>
  );
}
