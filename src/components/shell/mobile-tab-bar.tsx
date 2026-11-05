"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import type { Role } from "@prisma/client";
import { cn } from "@/lib/utils";
import { bestPage, hubsFor } from "./nav";

/* The destinations live in ./nav.ts as hubs; this file only lays them out. */

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

  // The bar reacts to scrolling (see .dock-glass in globals.css).
  const dockRef = React.useRef<HTMLElement | null>(null);
  useDockScroll(dockRef);

  const hubs = hubsFor(role);
  const tabs = hubs.slice(0, 4);
  const moreItems = hubs.slice(4);
  // One winner across every page of every hub, so /inventory/counts lights
  // Stock and nothing else.
  const allPages = hubs.flatMap((h) => h.pages.map((p) => ({ ...p, hub: h.key })));
  const current = bestPage(pathname, allPages) as ((typeof allPages)[number] | undefined);
  const isActive = (key: string) => current?.hub === key;
  const isCurrent = (href: string) => current?.href === href;
  const moreActive = moreItems.some((m) => isActive(m.key));

  return (
    <>
      {moreOpen && (
        <div
          className="more-scrim fixed inset-0 z-50 overscroll-contain bg-background/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMoreOpen(false)}
          aria-hidden
        />
      )}

      {/*
        "More": six tiles, not fourteen rows. Each is a hub (see nav.ts); the
        pages inside it are a tab strip once you are there.

        Motion: the sheet rises on a soft spring (more-sheet in globals.css)
        and the tiles settle in one after another, 30ms apart, so the eye
        reads them in order. All transform and opacity; off for reduced motion.
      */}
      <div
        className={cn(
          "more-sheet fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto overscroll-contain rounded-t-[28px] border-t border-border-soft bg-card px-5 pt-2.5 lg:hidden",
          "pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]",
          // invisible removes the links from the tab order while still
          // allowing the slide transition; aria-hidden alone left them focusable.
          moreOpen ? "visible translate-y-0" : "invisible pointer-events-none translate-y-full",
        )}
        data-open={moreOpen}
        ref={sheetRef}
        role="dialog"
        aria-modal={moreOpen}
        aria-hidden={!moreOpen}
        aria-label="More sections"
      >
        <div aria-hidden className="mx-auto mb-3 h-1 w-9 rounded-full bg-border" />
        <div className="mb-4 flex items-center justify-between">
          <span className="font-display text-base font-semibold">More</span>
          <button
            onClick={() => setMoreOpen(false)}
            className="lg-press grid h-9 w-9 place-items-center rounded-full bg-muted text-muted-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {moreItems.map((m, i) => {
            const Icon = m.icon;
            const on = isActive(m.key);
            return (
              <Link
                key={m.key}
                href={m.href}
                aria-current={on ? "page" : undefined}
                style={{ "--i": i } as React.CSSProperties}
                className={cn(
                  "more-tile lg-press flex flex-col items-center gap-2 rounded-[22px] px-2 py-4 text-[12.5px] font-medium",
                  on ? "bg-brand-muted text-brand-ink" : "text-foreground hover:bg-muted",
                )}
              >
                <span className={cn("grid h-11 w-11 place-items-center rounded-full", on ? "bg-card/60" : "bg-muted")}>
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="truncate">{m.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* The scroll-edge band is gone with the glass. It existed to stop
          content being cut off at a hard line as it passed under a
          see-through bar; the bar is opaque now, so there is nothing showing
          through to dissolve, and six stacked blur layers were being painted
          on every mobile frame to soften an edge nobody could see. */}

      {/*
        The dock. A quiet bar in the theme's own card colour with a hairline
        edge, so it sits with the page instead of on top of it.

        Every slot is the same shape — a 20px icon over a short label, on one
        baseline — so the row reads as one even strip. The current place is a
        soft tinted capsule behind its icon and a heavier label, not a bright
        circle: it should be findable, not the loudest thing on screen.
        Labels stay: a phone has no hover to explain an unlabelled glyph.
      */}
      <nav
        aria-label="Primary"
        ref={dockRef}
        className="dock-glass fixed bottom-[calc(12px+env(safe-area-inset-bottom,0px))] z-40 mx-auto max-w-md rounded-[26px] px-1.5 py-1.5 lg:hidden"
      >
        <div className="grid auto-cols-fr grid-flow-col">
          {tabs.map((t) => (
            <DockItem
              key={t.key}
              href={t.href}
              label={t.label}
              Icon={t.icon}
              active={isActive(t.key)}
              current={isCurrent(t.href)}
            />
          ))}
          {/* A staff member's whole app fits in the dock, so there is nothing
              left to put behind "More" — an empty sheet would be a dead end. */}
          {moreItems.length > 0 && (
            <button
              ref={triggerRef}
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              className={dockSlot}
            >
              <DockGlyph Icon={Menu} active={moreActive || moreOpen} />
              <DockLabel active={moreActive || moreOpen}>More</DockLabel>
            </button>
          )}
        </div>
      </nav>
    </>
  );
}

const dockSlot = "lg-press flex min-h-[calc(34px+var(--lbl,1)*18px)] min-w-0 flex-col items-center justify-center rounded-[20px] px-1";

function DockGlyph({ Icon, active }: { Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>; active: boolean }) {
  return (
    <span
      className={cn(
        "grid h-7 w-12 place-items-center rounded-full transition-colors duration-200",
        active ? "dock-pop bg-dock-active text-dock-active-ink" : "text-foreground/70",
      )}
    >
      <Icon className="h-5 w-5" aria-hidden />
    </span>
  );
}

function DockLabel({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span className={cn("dock-label max-w-full truncate text-[10.5px] leading-none", active ? "font-semibold text-foreground" : "font-medium text-foreground/70")}>
      {children}
    </span>
  );
}

function DockItem({
  href, label, Icon, active, current,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  active: boolean;
  current: boolean;
}) {
  return (
    <Link href={href} aria-current={current ? "page" : undefined} className={dockSlot}>
      <DockGlyph Icon={Icon} active={active} />
      <DockLabel active={active}>{label}</DockLabel>
    </Link>
  );
}


/*
  Writes --boost (how fast the page is moving, 0 to 1) and --sheen (scroll
  position) onto the dock. Straight to the element's style from one passive
  scroll listener and one animation frame, so scrolling costs no React renders.

  The boost follows speed with a quick rise and a slower fall: 2.4 px/ms (a firm
  flick) is full strength, and it eases back to nothing about 350ms after the
  page stops. Off entirely for reduced motion.
*/
function useDockScroll(ref: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let lastY = window.scrollY;
    let lastT = performance.now();
    let boost = 0;
    let raf = 0;
    const write = () => {
      el.style.setProperty("--boost", boost.toFixed(3));
      el.style.setProperty("--sheen", String(Math.round(window.scrollY)));
    };
    const tick = (t: number) => {
      const dt = Math.max(1, t - lastT);
      const y = window.scrollY;
      const speed = Math.abs(y - lastY) / dt; // px per ms
      lastY = y;
      lastT = t;
      const target = Math.min(1, speed / 1.8);
      // Up fast, down slowly.
      boost += (target - boost) * (target > boost ? 0.35 : 0.08);
      if (boost < 0.004 && target === 0) boost = 0;
      write();
      raf = boost > 0 || target > 0 ? requestAnimationFrame(tick) : 0;
    };
    const onScroll = () => { if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(tick); } };
    window.addEventListener("scroll", onScroll, { passive: true });
    write();
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, [ref]);
}
