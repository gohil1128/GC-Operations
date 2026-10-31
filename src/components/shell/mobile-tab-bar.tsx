"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, TrendingUp, Wallet, FileText, Menu,
  Boxes, Users, Receipt, Settings as SettingsIcon, ChefHat, X, CalendarDays, ShoppingBag,
  ClipboardCheck, Scale, Clock, Truck, CirclePlus, Plug, Download, Contact, CalendarClock,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { cn } from "@/lib/utils";
import { LiquidIndicator } from "@/components/liquid-indicator";
import { can, type Capability } from "@/lib/permissions";

/*
  One ordered list of every destination, most important first. The bottom bar
  takes the first four the role can actually reach and the rest go behind
  "More" — so an owner and a manager get exactly the bar they had before, and
  a staff member gets their two screens in the bar instead of an empty bar
  with everything hidden in a sheet.
*/
/*
  EVERY DESTINATION HAS ITS OWN GLYPH. It did not: four of these were a sheet
  of paper (Invoices, Purchase orders, New purchase order, Data export), three
  were a bar chart (Reports, Variance, Labor report), three were a pair of
  people (Schedule, Employees, Team), and two were a stack of boxes (Counts,
  Ingredients). In the More sheet those sit in one scrolling list, so a dozen
  rows carried four pictures between them and the icon column told you
  nothing — you were reading the labels and the glyphs were decoration.
*/
const DESTINATIONS: { href: string; label: string; icon: typeof Wallet; cap: Capability }[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, cap: "overview" },
  // Events sits in the bar rather than behind "More": it is the thing this
  // business is organised around, and every other screen is scoped by it.
  { href: "/events", label: "Events", icon: CalendarDays, cap: "events" },
  { href: "/reports", label: "Reports", icon: TrendingUp, cap: "financials" },
  { href: "/purchasing/invoices", label: "Invoices", icon: FileText, cap: "purchasing" },
  // Below the four bar slots on purpose: Sales is a read-it-later screen, and
  // promoting it would push Invoices — which carries the open-bill badge —
  // into the More sheet.
  { href: "/sales", label: "Sales", icon: ShoppingBag, cap: "financials" },
  { href: "/cash", label: "Cash closes", icon: Wallet, cap: "cash" },
  { href: "/inventory/counts", label: "Counts", icon: ClipboardCheck, cap: "inventoryCount" },
  { href: "/inventory", label: "Ingredients", icon: Boxes, cap: "inventory" },
  { href: "/inventory/variance", label: "Variance", icon: Scale, cap: "inventory" },
  { href: "/recipes", label: "Recipes", icon: ChefHat, cap: "inventory" },
  { href: "/labor", label: "Schedule", icon: CalendarClock, cap: "labor" },
  { href: "/labor/report", label: "Labor report", icon: Clock, cap: "labor" },
  { href: "/labor/employees", label: "Employees", icon: Contact, cap: "labor" },
  { href: "/expenses", label: "Expenses", icon: Receipt, cap: "expenses" },
  { href: "/purchasing", label: "Purchase orders", icon: Truck, cap: "purchasing" },
  { href: "/purchasing/new", label: "New purchase order", icon: CirclePlus, cap: "purchasing" },
  { href: "/settings", label: "Business & events", icon: SettingsIcon, cap: "settings" },
  { href: "/settings/users", label: "Team", icon: Users, cap: "settings" },
  { href: "/settings/integrations", label: "Integrations", icon: Plug, cap: "settings" },
  { href: "/settings/exports", label: "Data export", icon: Download, cap: "settings" },
];

export function MobileTabBar({ role }: { role: Role }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const sheetRef = React.useRef<HTMLDivElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);

  // Close the sheet on navigation.
  React.useEffect(() => { setMoreOpen(false); }, [pathname]);

  // Lock the page while the sheet is open, otherwise a swipe on the dim overlay
  // scrolls the content behind it. Preserving/restoring scrollTop avoids the
  // jump-to-top that a bare `overflow:hidden` causes on iOS.
  React.useEffect(() => {
    if (!moreOpen) return;
    const y = window.scrollY;
    const { body } = document;
    const prev = { position: body.style.position, top: body.style.top, width: body.style.width };
    body.style.position = "fixed";
    body.style.top = `-${y}px`;
    body.style.width = "100%";
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      window.scrollTo(0, y);
    };
  }, [moreOpen]);

  // Move focus into the sheet on open and hand it back on close — but only on a
  // real open->close transition. Running the restore branch on mount stole focus
  // to the More button on every page load.
  const wasOpen = React.useRef(false);
  React.useEffect(() => {
    if (moreOpen) {
      // after the open transition commits, so the target is focusable
      requestAnimationFrame(() =>
        sheetRef.current?.querySelector<HTMLElement>("a, button")?.focus(),
      );
    } else if (wasOpen.current) {
      triggerRef.current?.focus({ preventScroll: true });
    }
    wasOpen.current = moreOpen;
  }, [moreOpen]);

  // Trap Tab inside the sheet while it is open.
  React.useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !sheetRef.current) return;
      const f = Array.from(
        sheetRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"),
      ).filter((el) => el.offsetParent !== null);
      if (f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  // Escape closes the sheet.
  React.useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMoreOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const visible = DESTINATIONS.filter((d) => can(role, d.cap));
  const tabs = visible.slice(0, 4);
  const moreItems = visible.slice(4);
  // Pick a single winner: the longest matching href. Otherwise /inventory and
  // /inventory/counts both render as the current page.
  const bestMatch = visible
    .map((x) => x.href)
    .filter((h) => isActive(h))
    .sort((a, b) => b.length - a.length)[0];
  const isCurrent = (href: string) => href === bestMatch;
  const moreActive = moreItems.some((m) => isActive(m.href)) && !tabs.some((t) => isActive(t.href));

  /* Which item the indicator sits under. "More" counts as a destination for
     this purpose: when the current page lives behind it, the bar should still
     show where you are rather than going blank. Null on a page that is in no
     tab at all, which hides the indicator rather than parking it at zero. */
  const activeTabKey = moreActive || moreOpen
    ? "__more"
    : (tabs.find((t) => isActive(t.href))?.href ?? null);

  return (
    <>
      {moreOpen && (
        <div
          className="fixed inset-0 z-50 overscroll-contain bg-espresso/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMoreOpen(false)}
          aria-hidden
        />
      )}

      {/* "More" sheet */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto overscroll-contain rounded-t-bento-lg border-t border-border bg-card px-4 pt-5 transition-[transform,visibility] duration-200 lg:hidden",
          "pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]",
          // invisible removes the 12 links from the tab order while still
          // allowing the slide transition; aria-hidden alone left them focusable.
          moreOpen ? "visible translate-y-0" : "invisible pointer-events-none translate-y-full",
        )}
        ref={sheetRef}
        role="dialog"
        aria-modal={moreOpen}
        aria-hidden={!moreOpen}
        aria-label="More sections"
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="font-display text-lg font-semibold">More</span>
          <button
            onClick={() => setMoreOpen(false)}
            className="grid h-9 w-9 place-items-center rounded-full border border-border"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {moreItems.map((m) => {
            const Icon = m.icon;
            return (
              <Link
                key={m.href}
                href={m.href}
                aria-current={isCurrent(m.href) ? "page" : undefined}
                className={cn(
                  "touch-target flex items-center gap-2.5 rounded-2xl border px-3.5 py-3 text-[13px] font-medium",
                  isCurrent(m.href)
                    ? "border-espresso bg-espresso text-espresso-foreground"
                    : "border-border bg-card",
                )}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-70" />
                <span className="truncate">{m.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Scroll edge: the page dissolves into the bar instead of being cut
          off at a hard line where it passes beneath. */}
      <div className="lg-edge lg:hidden" aria-hidden>
        <i><i><i><i><i><i /></i></i></i></i></i>
      </div>

      {/* Fixed bottom bar — hidden once the desktop pill nav has room. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border glass px-2 pb-[env(safe-area-inset-bottom,0px)] lg:hidden"
        aria-label="Primary"
      >
        <div className="relative mx-auto flex max-w-lg items-stretch">
          {/* Travels along the bar rather than lighting up in place. */}
          <LiquidIndicator activeKey={activeTabKey} axis="x" className="lg-indicator-soft" />
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = isActive(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={isCurrent(t.href) ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors",
                  active ? "text-brand-ink" : "text-muted-foreground",
                )}
              >
                <span
                  data-lg-item={t.href}
                  className="relative z-10 grid h-8 w-14 place-items-center rounded-full"
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                {t.label}
              </Link>
            );
          })}
          {/* A staff member's whole app fits in the bar, so there is nothing
              left to put behind "More" — an empty sheet would be a dead end. */}
          {moreItems.length > 0 && (
            <button
              ref={triggerRef}
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors",
                moreActive || moreOpen ? "text-brand-ink" : "text-muted-foreground",
              )}
            >
              <span
                data-lg-item="__more"
                className="relative z-10 grid h-8 w-14 place-items-center rounded-full"
              >
                <Menu className="h-[18px] w-[18px]" />
              </span>
              More
            </button>
          )}
        </div>
      </nav>
    </>
  );
}
