"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid, TrendingUp, FileText, ShoppingBag, Wallet, Boxes, Users,
  CalendarDays, ClipboardCheck, Settings as SettingsIcon,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { cn } from "@/lib/utils";
import { can, ROLE_LABELS, type Capability } from "@/lib/permissions";
import { APP_NAME } from "@/lib/brand";
import { LiquidIndicator } from "@/components/liquid-indicator";

/*
  The soft-glass rail: a floating frosted column of destinations.

  THE LABELS ARE VISIBLE, and that is the point of this file.

  It used to be icon-only, with the name in a title attribute and a screen
  reader label. Both of those are invisible to the person this app is actually
  used by: a title tooltip needs a pointer to hover, and the tablet at the
  stall has no pointer, so on the one device that matters every destination
  was an unlabelled glyph. Two of them were the SAME glyph — Inventory and
  Counts were both a stack of boxes — so even someone who had learned the
  icons could not tell those two apart.

  So each item now carries its name at 12px under the icon, and Counts has a
  clipboard of its own. Short names where the full one will not fit: the
  visible word is the one that fits the column, the full name stays in the
  screen-reader label and the tooltip, and both still say "Profit & loss".

  The rail is 88px rather than 64px to pay for it, which is 24px of content
  width on large screens. The same capability filter the old sidebar used
  decides what appears, so nothing became reachable or unreachable here.
*/

/* `label` is the full name, for the screen reader and the tooltip. `short` is
   what the 88px column can actually show; it is only set where the full name
   does not fit. */
type Item = { href: string; label: string; short?: string; icon: typeof LayoutGrid; cap: Capability };

const ITEMS: Item[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid, cap: "overview" },
  { href: "/events", label: "Events", icon: CalendarDays, cap: "events" },
  { href: "/reports", label: "Profit & loss", short: "P&L", icon: TrendingUp, cap: "financials" },
  { href: "/sales", label: "Sales", icon: ShoppingBag, cap: "financials" },
  { href: "/purchasing/invoices", label: "Invoices", icon: FileText, cap: "purchasing" },
  { href: "/cash", label: "Cash closes", short: "Cash", icon: Wallet, cap: "cash" },
  { href: "/inventory", label: "Inventory", icon: Boxes, cap: "inventory" },
  // Its own glyph, not the Inventory boxes. These two sit next to each other
  // and were indistinguishable.
  { href: "/inventory/counts", label: "Counts", icon: ClipboardCheck, cap: "inventoryCount" },
  { href: "/labor", label: "Labor", icon: Users, cap: "labor" },
];

const SETTINGS: Item = {
  href: "/settings",
  label: "Settings",
  icon: SettingsIcon,
  cap: "settings",
};

export function IconRail({ role, userName }: { role: Role; userName: string }) {
  const pathname = usePathname();

  // A staff member can reach /inventory/counts but not /inventory, so the two
  // are separate entries and only the permitted one renders.
  const items = ITEMS.filter(
    (i) => can(role, i.cap) && !(i.href === "/inventory/counts" && can(role, "inventory")),
  );
  const showSettings = can(role, SETTINGS.cap);

  const active = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");
  // Longest match wins, so /inventory/counts does not also light up /inventory.
  const current = [...items, ...(showSettings ? [SETTINGS] : [])]
    .map((i) => i.href)
    .filter(active)
    .sort((a, b) => b.length - a.length)[0];

  const initial = userName.trim().charAt(0).toUpperCase() || "U";

  return (
    <nav
      aria-label="Sections"
      className="glass-pill lg-thin fixed left-[18px] top-[18px] z-40 hidden h-[calc(100dvh-36px)] w-[88px] flex-col items-center gap-1 rounded-[32px] px-2 py-4 lg:flex"
    >
      {/* One object that travels between items, rather than a background
          switched on and off per item. See LiquidIndicator for why that
          distinction is the whole effect. */}
      <LiquidIndicator activeKey={current ?? null} axis="y" />
      <Link href="/dashboard" className="logo-plate mb-2 shrink-0" aria-label={`${APP_NAME} — Overview`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" aria-hidden className="h-7 w-auto" />
      </Link>

      {items.map((i) => (
        <RailButton key={i.href} item={i} current={current === i.href} />
      ))}

      {showSettings && (
        <>
          <span aria-hidden className="my-1 h-px w-6 shrink-0 bg-foreground/15" />
          <RailButton item={SETTINGS} current={current === SETTINGS.href} />
        </>
      )}

      <span
        /* brand-strong, not brand. White on the logo rust is 4.47:1 — a hair under
           the 4.5 this 14px initial needs. The darker step exists for exactly
           this and clears 5.5:1. Long-standing, found by measuring every page
           rather than by looking at it. */
        className="mt-auto grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-strong text-sm font-semibold text-brand-foreground"
        title={`${userName} · ${ROLE_LABELS[role]}`}
      >
        {initial}
        <span className="sr-only">
          Signed in as {userName}, {ROLE_LABELS[role]}
        </span>
      </span>
    </nav>
  );
}

function RailButton({ item, current }: { item: Item; current: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={item.label}
      aria-current={current ? "page" : undefined}
      // Measured by the indicator, which finds its target by this attribute.
      data-lg-item={item.href}
      className={cn(
        /*
          No fill and no border of its own, in either state.

          Apple says this twice in two different sessions: remove any extra
          background or darkening layer behind the items in a glass bar. The
          reason is both aesthetic and technical — a pill inside a pane of
          glass is a second surface competing with the first, and glass cannot
          sample other glass, so the inner fills were quietly flattening the
          one surface that was supposed to be refracting. The rail is one pane;
          the items are glyphs on it.

          The current item's fill is the travelling indicator, which sits
          behind this. relative + z-10 keeps the glyph above it.
        */
        "lg-press relative z-10 flex w-full shrink-0 flex-col items-center gap-1 rounded-[18px] px-1 py-2",
        current
          ? "text-espresso-foreground"
          : "text-secondary-foreground hover:bg-foreground/[0.06]",
      )}
    >
      <Icon className="h-[17px] w-[17px]" aria-hidden />
      {/* aria-hidden because the full name is already on the link below. Left
          readable, the screen reader would say "P&L Profit & loss". */}
      <span aria-hidden className="text-xs leading-none tracking-tight">
        {item.short ?? item.label}
      </span>
      <span className="sr-only">{item.label}</span>
    </Link>
  );
}
