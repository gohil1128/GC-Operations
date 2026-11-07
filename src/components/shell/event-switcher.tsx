"use client";
import { EventMark } from "@/components/event-mark";
import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Calendar, Check, ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// Routes whose data is genuinely event-scoped. Everywhere else (inventory,
// labor, recipes, settings) has no event dimension, and /reports is a
// cross-event matrix by design — showing a per-event filter there would imply
// a narrowing that never happens.
//
// Not /dashboard. The Overview has its own event control, which writes this
// same cookie, so a second one in the header was the same choice offered twice
// on one screen.
const EVENT_SCOPED = ["/expenses", "/cash", "/purchasing/invoices"];
import { Button } from "@/components/ui/button";
import { setActiveEventAction } from "@/modules/events/actions";

type Ev = {
  id: string;
  name: string;
  color: string | null;
  startDate: Date | string;
  endDate: Date | string;
};

export function EventSwitcher({ events, activeEventId }: { events: Ev[]; activeEventId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = React.useTransition();
  const active = events.find((e) => e.id === activeEventId);

  const scoped = EVENT_SCOPED.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!scoped) return null;

  const change = (id: string | null) => {
    start(async () => {
      await setActiveEventAction(id);
      router.refresh();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={pending} className="gap-2 data-[state=open]:border-foreground/20 data-[state=open]:bg-accent">
          {active ? (
            <EventMark name={active.name} size="xs" />
          ) : (
            <Calendar className="h-3.5 w-3.5" />
          )}
          <span className="hidden max-w-[140px] truncate font-medium sm:inline">{active ? active.name : "All events"}</span>
          <ChevronsUpDown className="hidden h-3.5 w-3.5 opacity-60 sm:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Filter by event</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => change(null)} className="justify-between">
          <span>All events</span>
          {!activeEventId && <Check className="h-3.5 w-3.5" />}
        </DropdownMenuItem>
        {events.length > 0 && <DropdownMenuSeparator />}
        {events.map((e) => {
          const start = typeof e.startDate === "string" ? e.startDate.slice(0, 10) : e.startDate.toISOString().slice(0, 10);
          const end = typeof e.endDate === "string" ? e.endDate.slice(0, 10) : e.endDate.toISOString().slice(0, 10);
          return (
            <DropdownMenuItem key={e.id} onClick={() => change(e.id)} className="justify-between">
              <span className="flex items-center gap-2 min-w-0">
                <EventMark name={e.name} size="xs" />
                <span className="truncate">{e.name}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-2xs text-muted-foreground">{start === end ? start : `${start} → ${end}`}</span>
                {e.id === activeEventId && <Check className="h-3.5 w-3.5" />}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
