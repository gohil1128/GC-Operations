"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid, TrendingUp, FileText, ShoppingBag, Wallet, Boxes, Users,
  CalendarDays, ClipboardCheck, Plus, Settings as SettingsIcon,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { cn } from "@/lib/utils";
import { can, ROLE_LABELS, type Capability } from "@/lib/permissions";
import { UserMenu } from "@/components/shell/user-menu";
import { APP_NAME } from "@/lib/brand";

/*
  The v3 sidebar: 232px, grouped into sections, every destination named.

  It replaces the floating glass rail. Two things carried over deliberately.

  The first is the capability filter: the same `can(role, cap)` decides what
  appears, and Counts is still swapped out for whoever can reach the whole of
  Inventory. Nothing became reachable or unreachable by restyling the nav, and
  that is worth saying because a nav rewrite is exactly where a permission
  quietly goes missing.

  The second is the order, which matches what the rail had, which in turn
  matched the order people were already used to.

  What did NOT carry over is the travelling indicator. v3 marks the current
  item with a white fill and a 1px seat, so there is no single object moving
  between items any more — the fill belongs to the item, not to the bar.
*/

type Item = {
  href: string;
  label: string;
  icon: typeof LayoutGrid;
  cap: Capability;
  /** Renders the open-invoice count. Only Invoices sets it. */
  badge?: "invoices";
  /** Renders a rust dot when a day's drawer has not been counted. */
  dot?: "cash";
};

const OPERATE: Item[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid, cap: "overview" },
  { href: "/events", label: "Events", icon: CalendarDays, cap: "events" },
  { href: "/reports", label: "Profit & loss", icon: TrendingUp, cap: "financials" },
  { href: "/sales", label: "Sales", icon: ShoppingBag, cap: "financials" },
  { href: "/purchasing/invoices", label: "Invoices", icon: FileText, cap: "purchasing", badge: "invoices" },
  { href: "/cash", label: "Cash closes", icon: Wallet, cap: "cash", dot: "cash" },
];

const STOCK_AND_TEAM: Item[] = [
  { href: "/inventory", label: "Inventory", icon: Boxes, cap: "inventory" },
  { href: "/inventory/counts", label: "Counts", icon: ClipboardCheck, cap: "inventoryCount" },
  { href: "/labor", label: "Labor", icon: Users, cap: "labor" },
];

const SETTINGS: Item = { href: "/settings", label: "Settings", icon: SettingsIcon, cap: "settings" };

export type SidebarProps = {
  role: Role;
  userName: string;
  userEmail: string;
  locationName: string;
  /** Open invoices, for the count badge. */
  openInvoices: number;
  /** A day that took money but was never counted, for the rust dot. */
  hasUncountedDrawer: boolean;
  /** When sales last arrived from Square, or null if they never have. */
  squareLastImport: string | null;
};

export function Sidebar({
  role, userName, userEmail, locationName, openInvoices, hasUncountedDrawer, squareLastImport,
}: SidebarProps) {
  const pathname = usePathname();

  // A staff member can reach /inventory/counts but not /inventory, so the two
  // are separate entries and only the permitted one renders.
  const visible = (items: Item[]) =>
    items.filter((i) => can(role, i.cap) && !(i.href === "/inventory/counts" && can(role, "inventory")));

  const operate = visible(OPERATE);
  const stock = visible(STOCK_AND_TEAM);
  const showSettings = can(role, SETTINGS.cap);
  const showConnected = can(role, "settings");

  // Longest match wins, so /inventory/counts does not also light up /inventory.
  const current = [...operate, ...stock, ...(showSettings ? [SETTINGS] : [])]
    .map((i) => i.href)
    .filter((href) => pathname === href || pathname.startsWith(href + "/"))
    .sort((a, b) => b.length - a.length)[0];

  const initial = userName.trim().charAt(0).toUpperCase() || "U";

  const row = (i: Item) => (
    <NavRow
      key={i.href}
      item={i}
      current={current === i.href}
      badge={i.badge === "invoices" && openInvoices > 0 ? openInvoices : null}
      dot={i.dot === "cash" && hasUncountedDrawer}
    />
  );

  return (
    /* In dark the column sits on the page's own base rather than the tint:
       the tint is LIGHTER than the base there, and a nav brighter than the
       content it frames reads as the main thing on screen. The current item is
       a lifted card, the reference's dark tile. */
    <nav
      aria-label="Sections"
      className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-muted px-4 pb-[18px] pt-[22px] lg:flex dark:bg-background"
    >
      {/* logo-plate: in dark the mark sits on a cream plate. Bare, it was a
          brown logo on a near-black column and effectively invisible. */}
      <Link href="/dashboard" className="logo-plate mb-[18px] flex w-fit items-center gap-2.5 px-2" aria-label={`${APP_NAME} — Overview`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt={APP_NAME} className="h-[34px] w-auto" />
      </Link>

      <SectionLabel>Operate</SectionLabel>
      {operate.map(row)}

      {stock.length > 0 && (
        <>
          <SectionLabel className="pt-4">Stock &amp; team</SectionLabel>
          {stock.map(row)}
        </>
      )}

      {showConnected && (
        <>
          <SectionLabel className="pt-4">Connected</SectionLabel>
          {/*
            Square only, and only what the database actually knows.

            The design also shows a bank feed with a "Today" status. There is
            no bank feed in this app and no column that could answer it, so
            inventing a row with a green timestamp would be inventing the
            integration too. Square's status is real: it is the last time a
            DailySales row arrived with source SQUARE.
          */}
          <Link
            href="/settings/integrations"
            className="lg-press flex items-center gap-[11px] rounded-xl px-3 py-2.5 text-[13.5px] text-secondary-foreground hover:bg-foreground/[0.04]"
          >
            <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md bg-espresso text-[10px] font-bold text-espresso-foreground">
              Sq
            </span>
            Square POS
            <span className={cn("ml-auto text-[11px]", squareLastImport ? "text-success" : "text-muted-foreground")}>
              {squareLastImport ?? "Not set up"}
            </span>
          </Link>
          <Link
            href="/settings/integrations"
            className="lg-press flex items-center gap-[11px] rounded-xl px-3 py-2.5 text-[13.5px] font-medium text-brand-ink hover:bg-foreground/[0.04]"
          >
            <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md border-[1.5px] border-dashed border-brand">
              <Plus className="h-3 w-3" aria-hidden />
            </span>
            Connect an app
          </Link>
        </>
      )}

      <div className="mt-auto flex flex-col gap-1 pt-[18px]">
        {showSettings && <NavRow item={SETTINGS} current={current === SETTINGS.href} badge={null} dot={false} />}
        {/* The card IS the menu. v3 draws it as a static block, but sign-out,
            theme and the account links have to live somewhere, and a second
            copy of them elsewhere would drift from this one. */}
        <UserMenu
          name={userName}
          email={userEmail}
          role={role}
          locationName={locationName}
          align="start"
          trigger={
            <button
              type="button"
              className="lg-press mt-1.5 flex w-full items-center gap-2.5 rounded-[14px] bg-card p-3 text-left"
            >
              <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-brand-strong text-[13px] font-semibold text-brand-foreground">
                {initial}
              </span>
              <div className="min-w-0 text-[12.5px] leading-tight">
                <div className="truncate font-semibold">{userName}</div>
                <div className="text-muted-foreground">{ROLE_LABELS[role]}</div>
              </div>
            </button>
          }
        />
      </div>
    </nav>
  );
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("px-2.5 py-1.5 text-[11px] text-muted-foreground", className)}>{children}</div>
  );
}

function NavRow({
  item, current, badge, dot,
}: { item: Item; current: boolean; badge: number | null; dot: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "lg-press flex items-center gap-[11px] rounded-xl px-3 py-2.5 text-[13.5px]",
        current
          ? "bg-card font-semibold text-foreground shadow-[0_1px_2px_hsl(var(--ink-800)/0.08)] dark:shadow-none"
          : "text-secondary-foreground hover:bg-foreground/[0.04]",
      )}
    >
      <Icon className="h-[17px] w-[17px] shrink-0" aria-hidden />
      <span className="truncate">{item.label}</span>
      {badge !== null && (
        <span className="ml-auto rounded-full bg-alert-muted px-2 py-0.5 text-[11px] font-semibold text-alert">
          {badge}
          <span className="sr-only"> open</span>
        </span>
      )}
      {dot && (
        <span className="ml-auto flex items-center gap-1.5">
          <span aria-hidden className="h-[7px] w-[7px] rounded-full bg-brand" />
          <span className="sr-only">a drawer has not been counted</span>
        </span>
      )}
    </Link>
  );
}
