"use client";
import * as React from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import type { Role } from "@prisma/client";
import { cn } from "@/lib/utils";
import { markNavigation } from "@/lib/nav-kind";
import { bestPage, hubsFor } from "./nav";

/* The destinations live in ./nav.ts as hubs; this file only lays them out. */

/*
  The neighbour previews. Each is the neighbouring tab's own page, loaded in an
  invisible same-origin frame and cropped to the area under the app header, so
  that while you drag, the next screen is really there beside this one and moves
  with your finger. Nothing in a frame can be tapped (pointer-events off), the
  header, dock and sidebar are hidden inside it, and they are all thrown away
  as soon as the real page has taken over.
*/
const previews = new Map<string, { wrap: HTMLDivElement; frame: HTMLIFrameElement }>();

function removePreviews() {
  previews.forEach((pv) => pv.wrap.remove());
  previews.clear();
}

/*
  The handoff from a swiped-in preview to the real page.

  The preview is a picture of the page you swiped to. It stays up until that
  page has really arrived and been painted, and only then dissolves, so what
  you see is the destination from the moment you let go to the moment you can
  use it — never the old page, never an empty skeleton in between. (It used to
  come down 60ms after the address changed, whether or not the page behind it
  was ready, which is the flash of grey boxes between two screens of content.)

  `from` is the path the swipe left. It is set when a swipe commits and cleared
  when the handoff is done, so a null means no swipe is in flight.
*/
const handoff: { from: string | null; slideDone: boolean } = { from: null, slideDone: true };

function resetMain() {
  const m = document.getElementById("main");
  if (m) { m.style.transition = ""; m.style.transform = ""; }
}

function fadeOutPreviews() {
  const shown = [...previews.values()].filter((pv) => pv.wrap.style.visibility === "visible");
  if (shown.length === 0) { removePreviews(); return; }
  shown.forEach((pv) => { pv.wrap.style.transition = "opacity 150ms ease-out"; pv.wrap.style.opacity = "0"; });
  window.setTimeout(removePreviews, 180);
}

/** Finish the handoff once the slide is over AND the new page has replaced the old one. */
function finishHandoff(currentPath: string) {
  if (handoff.from === null || !handoff.slideDone || currentPath === handoff.from) return;
  handoff.from = null;
  // Back to rest while the opaque preview hides it, then two frames for the new
  // page to paint under the preview before the preview dissolves.
  resetMain();
  requestAnimationFrame(() => requestAnimationFrame(fadeOutPreviews));
}

function ensurePreview(href: string) {
  if (previews.has(href)) return;
  const header = document.querySelector("header");
  const top = Math.max(0, Math.round(header?.getBoundingClientRect().bottom ?? 0));
  const wrap = document.createElement("div");
  wrap.setAttribute("aria-hidden", "true");
  Object.assign(wrap.style, {
    position: "fixed", left: "0", top: `${top}px`, width: "100%", height: `calc(100dvh - ${top}px)`,
    overflow: "hidden", zIndex: "5", pointerEvents: "none", visibility: "hidden",
    background: "hsl(var(--background))", willChange: "transform", transform: "translateX(100%)",
  } as Partial<CSSStyleDeclaration>);
  const frame = document.createElement("iframe");
  frame.tabIndex = -1;
  frame.title = "";
  Object.assign(frame.style, { border: "0", width: "100%", height: "100%", display: "block", background: "transparent" } as Partial<CSSStyleDeclaration>);
  // A still picture of the page, not a second running copy of the app: fetch its
  // server-rendered HTML, drop the app's own script files (keeping the tiny inline
  // ones that swap streamed content into place), and show it in a srcdoc frame (which
  // never goes through the site's anti-framing header). The real page replaces
  // it the moment the swipe completes.
  fetch(href, { credentials: "same-origin", headers: { accept: "text/html" } })
    .then((r) => (r.ok ? r.text() : ""))
    .then((html) => {
      if (!html || !previews.has(href)) return;
      const css = "<style>header,nav[aria-label=Primary],aside,a[href='#main']{display:none!important}html,body{overscroll-behavior:none}*{scrollbar-width:none}</style>";
      frame.srcdoc = html.replace(/<script\b[^>]*\bsrc=[^>]*>[\s\S]*?<\/script>/gi, "").replace("</head>", `${css}</head>`);
    })
    .catch(() => {});
  frame.addEventListener("load", () => {
    try {
      const root = frame.contentDocument?.documentElement;
      if (root) root.className = document.documentElement.className; // light / dark
    } catch { /* ignore */ }
  });
  wrap.appendChild(frame);
  document.body.appendChild(wrap);
  previews.set(href, { wrap, frame });
}

export function MobileTabBar({ role }: { role: Role }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const sheetRef = React.useRef<HTMLDivElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const sheetDrag = React.useRef<{ y: number; t: number } | null>(null);

  // Close the sheet on navigation.
  React.useEffect(() => { setMoreOpen(false); }, [pathname]);

  // A finished swipe leaves the neighbour preview covering the page. Once the real
  // page is there (and the slide is over), dissolve the preview. Any other
  // navigation just clears away previews that were loaded for a swipe that never came.
  React.useEffect(() => {
    if (handoff.from !== null) { finishHandoff(pathname); return; }
    resetMain();
    const t = window.setTimeout(() => removePreviews(), 60);
    return () => window.clearTimeout(t);
  }, [pathname]);

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

  // Swipe sideways anywhere on a main screen: the neighbouring tab slides in
  // alongside, tracking the finger one to one, and settles on release.
  const router = useRouter();
  const swipeTabs = tabs.map((t) => ({ key: t.key, href: t.href }));
  const swipeRef = React.useRef({ pathname, moreOpen, swipeTabs, router });
  swipeRef.current = { pathname, moreOpen, swipeTabs, router };
  React.useEffect(() => {
    type Drag = { x: number; y: number; t: number; locked: boolean; px: number; pt: number; v: number };
    let d: Drag | null = null;
    let busy = false; // a release animation is running
    const main = () => document.getElementById("main");
    const reduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const blocked = (el: EventTarget | null) => {
      if (!(el instanceof Element)) return true;
      if (el.closest("input, textarea, select, [contenteditable=true], [data-no-swipe], [data-pager], [role=dialog], [role=listbox], [role=menu], table, nav, .more-sheet")) return true;
      for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) {
        const ox = getComputedStyle(n).overflowX;
        if ((ox === "auto" || ox === "scroll") && n.scrollWidth > n.clientWidth + 1) return true;
      }
      return false;
    };
    const neighbour = (dx: number) => {
      const c = swipeRef.current;
      const i = c.swipeTabs.findIndex((x) => x.href === c.pathname);
      return i < 0 ? undefined : c.swipeTabs[i + (dx < 0 ? 1 : -1)];
    };
    const W = () => window.innerWidth;
    const place = (dx: number, next: { href: string } | undefined) => {
      const m = main();
      if (m) m.style.transform = `translateX(${next ? dx : dx * 0.22}px)`;
      for (const [href, pv] of previews) {
        const on = !!next && href === next.href;
        pv.wrap.style.visibility = on ? "visible" : "hidden";
        if (on) pv.wrap.style.transform = `translateX(${dx + (dx < 0 ? W() : -W())}px)`;
      }
    };
    const animate = (on: boolean) => {
      const ease = "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)";
      const m = main();
      if (m) m.style.transition = ease;
      previews.forEach((pv) => { pv.wrap.style.transition = ease; });
    };
    const settle = (dx: number, next: { href: string } | undefined, commit: boolean) => {
      busy = true;
      animate(true);
      const end = commit && next ? (dx < 0 ? -W() : W()) : 0;
      place(end, commit ? next : undefined);
      if (!commit) {
        // put every preview back off-screen once the page has returned
        window.setTimeout(() => { previews.forEach((pv) => { pv.wrap.style.visibility = "hidden"; pv.wrap.style.transition = ""; }); const m = main(); if (m) { m.style.transition = ""; m.style.transform = ""; } busy = false; }, 340);
        return;
      }
      // Start fetching the page while the slide is still finishing: by 200ms the
      // eased slide is ~97% done, so the old page is already off-screen and
      // nothing is visible if the new one lands early. (It used to wait for the
      // whole slide AND 300ms more.)
      handoff.from = swipeRef.current.pathname;
      handoff.slideDone = false;
      window.setTimeout(() => {
        markNavigation("swipe"); // at the push, so the page's entrance is skipped when it lands
        window.dispatchEvent(new CustomEvent("gc:navigating", { detail: next!.href }));
        swipeRef.current.router.push(next!.href);
      }, 200);
      window.setTimeout(() => { handoff.slideDone = true; busy = false; finishHandoff(swipeRef.current.pathname); }, 340);
      // if the navigation is slow or fails, do not leave the preview up forever
      window.setTimeout(() => {
        if (handoff.from === null) return;
        handoff.from = null; handoff.slideDone = true; busy = false;
        resetMain();
        fadeOutPreviews();
      }, 6000);
    };
    const onStart = (e: TouchEvent) => {
      const c = swipeRef.current;
      d = null;
      if (busy || handoff.from !== null || e.touches.length !== 1 || c.moreOpen || window.innerWidth >= 1024) return;
      const t0 = e.touches[0];
      if (t0.clientX < 22 || t0.clientX > window.innerWidth - 22) return; // leave the browser's edge gestures alone
      if (blocked(e.target)) return;
      const i = c.swipeTabs.findIndex((x) => x.href === c.pathname);
      if (i < 0) return;
      // Get the neighbours loading while the finger is still down.
      if (!reduce()) [c.swipeTabs[i - 1], c.swipeTabs[i + 1]].forEach((n) => n && ensurePreview(n.href));
      d = { x: t0.clientX, y: t0.clientY, t: performance.now(), locked: false, px: t0.clientX, pt: performance.now(), v: 0 };
    };
    const onMove = (e: TouchEvent) => {
      if (!d || busy) return;
      const t = e.touches[0];
      const dx = t.clientX - d.x, dy = t.clientY - d.y;
      if (!d.locked) {
        if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { d = null; return; } // it is a scroll
        if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
        d.locked = true;
        const m = main(); if (m) m.style.transition = "none";
        previews.forEach((pv) => { pv.wrap.style.transition = "none"; });
      }
      if (e.cancelable) e.preventDefault();
      const now = performance.now();
      if (now - d.pt > 16) { d.v = (t.clientX - d.px) / (now - d.pt); d.px = t.clientX; d.pt = now; }
      if (reduce()) return;
      place(dx, neighbour(dx));
    };
    const onEnd = (e: TouchEvent) => {
      const st = d; d = null;
      if (!st?.locked) return;
      const dx = e.changedTouches[0].clientX - st.x;
      const next = neighbour(dx);
      const far = Math.abs(dx) > W() * 0.33;
      const flick = Math.abs(st.v) > 0.45 && Math.abs(dx) > 30 && Math.sign(st.v) === Math.sign(dx);
      const commit = !!next && (far || flick);
      if (reduce()) { if (commit) { markNavigation("swipe"); swipeRef.current.router.push(next!.href); } return; }
      settle(dx, next, commit);
    };
    const onCancel = () => { const st = d; d = null; if (st?.locked && !busy) settle(0, undefined, false); };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onCancel);
      removePreviews();
    };
  }, []);

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
        // Swipe down to dismiss: the sheet follows the finger from the top of its
        // scroll, and lets go past 90px (or on a quick flick).
        onTouchStart={(e) => {
          const el = sheetRef.current;
          if (!el || el.scrollTop > 0) { sheetDrag.current = null; return; }
          sheetDrag.current = { y: e.touches[0].clientY, t: Date.now() };
        }}
        onTouchMove={(e) => {
          const el = sheetRef.current, d = sheetDrag.current;
          if (!el || !d) return;
          const dy = e.touches[0].clientY - d.y;
          if (dy <= 0) { el.style.transform = ""; return; }
          el.style.transition = "none";
          el.style.transform = `translateY(${dy}px)`;
        }}
        onTouchEnd={(e) => {
          const el = sheetRef.current, d = sheetDrag.current;
          sheetDrag.current = null;
          if (!el || !d) return;
          const dy = e.changedTouches[0].clientY - d.y;
          const flick = dy > 30 && dy / Math.max(1, Date.now() - d.t) > 0.6;
          el.style.transition = "";
          el.style.transform = "";
          if (dy > 90 || flick) setMoreOpen(false);
        }}
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
  // True from the tap until the next screen has arrived: the tab lights up at
  // once, because the page you are on now stays until the new one is ready.
  const { pending } = useLinkStatus();
  return (
    <span
      className={cn(
        "grid h-7 w-12 place-items-center rounded-full transition-colors duration-200",
        active ? "dock-pop bg-dock-active text-dock-active-ink" : pending ? "dock-pending text-foreground" : "text-foreground/70",
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
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={dockSlot}
      // Tapping the tab you are already on takes you back to the top of it.
      onClick={(e) => {
        if (!current) return;
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      }}
    >
      <DockGlyph Icon={Icon} active={active} />
      <DockLabel active={active}>{label}</DockLabel>
    </Link>
  );
}


/*
  The dock follows how far, and which way, you have scrolled. One state `s`
  (0 = full bar, 1 = gone) that moves with the page and then STAYS where it is:

    down  s grows with the distance scrolled, faster the quicker the finger
          moves, so a flick makes it vanish and a slow drag only shrinks it
    up    s falls back gradually, in proportion to the distance scrolled
    still s is not touched, so a bar you left half-shrunk keeps that shape

  The first ~55% of s draws the bar in and drops its labels (--boost); the rest
  fades, sinks and shrinks it away (--gone). Written straight to the element
  from one passive listener and an eased animation frame, so scrolling costs
  no React renders. Back at the very top it is always whole. Off for reduced
  motion.
*/
function useDockScroll(ref: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    let lastY = Math.max(0, window.scrollY);
    let lastT = performance.now();
    let target = 0;   // where the scroll says the bar should be
    let shown = 0;    // where it is drawn, eased toward target
    let raf = 0;
    let glow = 0;     // icon glow: rises with scroll speed, fades after you stop
    const write = () => {
      el.style.setProperty("--glow", glow.toFixed(3));
      el.style.setProperty("--boost", clamp(shown / 0.55).toFixed(3));
      el.style.setProperty("--gone", clamp((shown - 0.55) / 0.45).toFixed(3));
      el.style.setProperty("--sheen", String(Math.round(window.scrollY)));
    };
    let glowTarget = 0;
    let lastMove = 0;
    const frame = () => {
      shown += (target - shown) * 0.28;
      if (Math.abs(target - shown) < 0.002) shown = target;
      if (performance.now() - lastMove > 90) glowTarget = 0; // finger/page has stopped
      glow += (glowTarget - glow) * (glowTarget > glow ? 0.3 : 0.07);
      if (glow < 0.004 && glowTarget === 0) glow = 0;
      write();
      raf = shown !== target || glow > 0 || glowTarget > 0 ? requestAnimationFrame(frame) : 0;
    };
    const onScroll = () => {
      const now = performance.now();
      const y = Math.max(0, window.scrollY); // ignore the rubber-band above the top
      const dy = y - lastY;
      const dt = Math.max(1, now - lastT);
      if (dy !== 0) { glowTarget = clamp(Math.abs(dy) / dt / 1.0); lastMove = now; }
      lastY = y;
      lastT = now;
      if (y <= 4) target = 0;
      else if (dy > 0) {
        const speed = dy / dt; // px per ms
        target = clamp(target + (dy / 900) * (1 + Math.max(0, speed - 0.4) * 4));
      } else if (dy < 0) {
        target = clamp(target + dy / 380);
      }
      if (!raf) raf = requestAnimationFrame(frame);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    write();
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, [ref]);
}
