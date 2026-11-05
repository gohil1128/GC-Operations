"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

/*
  Panes you swipe between, with a tab strip that follows your finger.

  This is the gc-tasks board's carousel (gc-tasks/src/components/board/
  use-column-swipe.ts), generalised from three fixed columns to any number of
  panes. It replaced a version built on the browser's scroll-snap, which was
  laggy: it re-rendered React on every scroll tick, and the browser decided
  when and how fast to settle.

  How it stays smooth:
    - The panes sit side by side on a track. While the finger is down, and
      while the track settles, the position is written straight to the DOM — a
      transform on the track and on the tab pill — so a swipe costs no React
      renders. React hears once, on release, through setActive.
    - Position is a fractional pane index (1.5 = halfway between panes 1 and 2).
      Both transforms are functions of it in percentages and fixed gaps, so
      they stay right if the phone rotates.
    - Letting go carries on from where the finger was, at the speed it had: a
      flick settles quickly, a slow drag slowly (140-360ms), as a Web Animations
      API animation on the compositor. A touch while it is still sliding
      catches it where it is, so quick swipes chain.
    - Past the first or last pane the track gives, but a quarter as far as the
      finger (rubber band).
    - It stays out of the way: a touch that starts out vertical is a scroll for
      good; touches within 20px of either screen edge are left to the system's
      back gesture; a touch in a text field or on [data-no-swipe] is ignored.
  From lg up the panes are an ordinary grid and none of this runs.
*/

export type PagerTab = { key: string; label: string; count?: number };

const SWIPE_MIN_X = 60;
const FLICK_MIN_X = 24;
/** px per ms over the last stretch of the swipe. */
const FLICK_VELOCITY = 0.4;
const ARM_PX = 12;
const EDGE_PX = 20;
const VELOCITY_WINDOW_MS = 100;
/** gap-4 between panes on the track, and gap-1 between the tabs. Keep in step with the classes below. */
const GAP_PX = 16;
const PILL_GAP_PX = 4;
const SETTLE_EASING = "cubic-bezier(0.22, 0.8, 0.3, 1)";
/** A tab tap: a calm, fixed slide. */
const TAP_MS = 300;

/** The pane a finished swipe lands on, or null to stay put. dx < 0 is a swipe to the left. */
export function paneAfterSwipe(current: number, last: number, dx: number, velocityX: number): number | null {
  const far = Math.abs(dx) >= SWIPE_MIN_X;
  const flick = Math.abs(dx) >= FLICK_MIN_X && Math.abs(velocityX) >= FLICK_VELOCITY;
  if (!far && !flick) return null;
  // A flick back the other way at the end cancels the swipe.
  if (velocityX !== 0 && Math.sign(velocityX) !== Math.sign(dx) && Math.abs(velocityX) >= FLICK_VELOCITY) return null;
  const next = current + (dx < 0 ? 1 : -1);
  return next >= 0 && next <= last ? next : null;
}

/** How long the track takes to cover the rest of its way: the finger's speed, floored, within 140-360ms. */
export function settleMs(remainingPx: number, velocityX: number): number {
  const speed = Math.max(Math.abs(velocityX), 0.8);
  return Math.round(Math.min(360, Math.max(140, remainingPx / speed)));
}

/** Past the ends the track gives a quarter as far as the finger. */
export function rubberBand(pos: number, last: number): number {
  if (pos < 0) return pos * 0.25;
  if (pos > last) return last + (pos - last) * 0.25;
  return pos;
}

const trackTransform = (pos: number) => `translateX(calc(${-pos * 100}% - ${pos * GAP_PX}px))`;
const pillTransform = (pos: number) => `translateX(calc(${pos * 100}% + ${pos * PILL_GAP_PX}px))`;
const isPhone = () => typeof window !== "undefined" && !window.matchMedia("(min-width: 1024px)").matches;

function startsInsideNoSwipe(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest("input, textarea, select, [contenteditable=true], [data-no-swipe]");
}

export function SwipePager({
  tabs, panes, initial = 0, className, tone = "default",
}: {
  tabs: PagerTab[];
  panes: React.ReactNode[];
  initial?: number;
  className?: string;
  /** "board" uses the events board's own ink tokens. */
  tone?: "default" | "board";
}) {
  const last = tabs.length - 1;
  const [active, setActive] = React.useState(Math.min(initial, last));

  const viewport = React.useRef<HTMLDivElement>(null);
  const trackEl = React.useRef<HTMLDivElement>(null);
  const pillEl = React.useRef<HTMLSpanElement>(null);
  /** Where the carousel logically is (a fractional pane index); animations run towards it. */
  const pos = React.useRef(Math.min(initial, last));
  const animations = React.useRef<Animation[]>([]);
  const latest = React.useRef({ active, last });
  latest.current = { active, last };

  /** Writes `p` to the pill and the track, and lights the tab nearest `lit`. */
  const place = React.useCallback((p: number, scrubbing: boolean, lit: number = p) => {
    const pill = pillEl.current;
    const t = trackEl.current;
    if (pill) {
      pill.style.transform = pillTransform(p);
      const group = pill.parentElement;
      if (group) {
        if (scrubbing) group.setAttribute("data-scrubbing", "true");
        else group.removeAttribute("data-scrubbing");
        const nearest = Math.round(Math.min(Math.max(lit, 0), latest.current.last));
        group.querySelectorAll<HTMLElement>("[data-tab]").forEach((tab, i) => {
          if (i === nearest) tab.setAttribute("data-lit", "true"); else tab.removeAttribute("data-lit");
        });
      }
    }
    if (t) t.style.transform = trackTransform(p);
  }, []);

  const stopAnimations = React.useCallback(() => {
    animations.current.forEach((a) => { a.onfinish = null; a.oncancel = null; a.cancel(); });
    animations.current = [];
  }, []);

  /** Where the carousel visibly is right now, mid-animation included. */
  const visiblePos = React.useCallback((): number => {
    const t = trackEl.current;
    const v = viewport.current;
    if (!t || !v || animations.current.length === 0) return pos.current;
    const step = t.offsetWidth + GAP_PX;
    return step > 0 ? (v.getBoundingClientRect().left - t.getBoundingClientRect().left) / step : pos.current;
  }, []);

  /** Slide the pill and the track from where they are to `to`. */
  const settle = React.useCallback((to: number, ms: number) => {
    const t = trackEl.current;
    const pill = pillEl.current;
    const from = visiblePos();
    stopAnimations();
    pos.current = to;
    if (ms <= 0 || from === to || typeof (t ?? pill)?.animate !== "function") { place(to, false); return; }
    // The label it is heading for turns dark as it sets off, not when it arrives.
    place(from, true, to);
    const options = { duration: ms, easing: SETTLE_EASING, fill: "forwards" as const };
    const run: Animation[] = [];
    if (t) run.push(t.animate([{ transform: trackTransform(from) }, { transform: trackTransform(to) }], options));
    if (pill) run.push(pill.animate([{ transform: pillTransform(from) }, { transform: pillTransform(to) }], options));
    animations.current = run;
    run[0].onfinish = () => {
      // Land the real styles first, then drop the animations, so nothing flickers.
      place(to, false);
      stopAnimations();
    };
  }, [place, stopAnimations, visiblePos]);

  // First paint: the track and pill already on the chosen pane (no slide in).
  React.useLayoutEffect(() => {
    if (isPhone()) place(pos.current, false);
  }, [place]);

  // Something other than a swipe moved the pane (a tab tap): bring the pill and track along.
  React.useLayoutEffect(() => {
    if (!isPhone()) { stopAnimations(); if (trackEl.current) trackEl.current.style.transform = ""; return; }
    if (pos.current === active) {
      // A swipe already on its way here (React heard on release): let it land.
      if (animations.current.length === 0) place(active, false);
      return;
    }
    settle(active, TAP_MS);
  }, [active, place, settle, stopAnimations]);

  // The viewport is only as tall as the pane you are on, so a short pane is not
  // followed by the empty height of the tallest one. It eases between panes.
  React.useLayoutEffect(() => {
    const v = viewport.current;
    const pane = trackEl.current?.children[active] as HTMLElement | undefined;
    if (!v || !pane) return;
    const apply = () => v.style.setProperty("--ph", `${pane.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(pane);
    return () => ro.disconnect();
  }, [active]);

  // Rotating the phone, or resizing across the lg line.
  React.useEffect(() => {
    const q = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      stopAnimations();
      if (q.matches) {
        if (trackEl.current) trackEl.current.style.transform = "";
        pillEl.current?.style.removeProperty("transform");
      } else place(latest.current.active, false);
    };
    q.addEventListener("change", onChange);
    return () => q.removeEventListener("change", onChange);
  }, [place, stopAnimations]);

  // The gesture.
  React.useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    let start: { x: number; y: number } | null = null;
    let mode: "pending" | "swipe" | "other" = "pending";
    let basePos = 0;
    let stepPx = 1;
    let dragPos = 0;
    let samples: { t: number; x: number }[] = [];
    let caught = false; // this touch caught the track mid-slide

    const now = (e: TouchEvent) => (e.timeStamp > 0 ? e.timeStamp : Date.now());
    const velocity = () => {
      const l = samples[samples.length - 1];
      if (!l) return 0;
      const f = samples.find((s) => l.t - s.t <= VELOCITY_WINDOW_MS);
      return f && l.t > f.t ? (l.x - f.x) / (l.t - f.t) : 0;
    };

    const onStart = (e: TouchEvent) => {
      start = null;
      if (e.touches.length !== 1 || !isPhone() || startsInsideNoSwipe(e.target)) return;
      const touch = e.touches[0];
      if (touch.clientX < EDGE_PX || touch.clientX > window.innerWidth - EDGE_PX) return;
      const t = trackEl.current;
      if (!t) return;
      // Still sliding from the last swipe: catch it where it is, so swipes chain.
      caught = animations.current.length > 0;
      if (caught) {
        basePos = visiblePos();
        stopAnimations();
        pos.current = basePos;
        place(basePos, true, latest.current.active);
      } else basePos = pos.current;
      stepPx = t.offsetWidth + GAP_PX;
      dragPos = basePos;
      start = { x: touch.clientX, y: touch.clientY };
      mode = "pending";
      samples = [{ t: now(e), x: touch.clientX }];
    };

    const onMove = (e: TouchEvent) => {
      if (!start) return;
      const touch = e.touches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (mode === "pending") {
        if (Math.abs(dy) > 8 && Math.abs(dy) >= Math.abs(dx)) { mode = "other"; return; }
        if (Math.abs(dx) < ARM_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
        mode = "swipe";
      }
      if (mode !== "swipe") return;
      e.preventDefault();
      samples.push({ t: now(e), x: touch.clientX });
      if (samples.length > 20) samples = samples.slice(-20);
      dragPos = basePos - dx / stepPx;
      place(rubberBand(dragPos, latest.current.last), true);
    };

    const onEnd = () => {
      if (!start) return;
      const wasSwipe = mode === "swipe";
      const fingerPos = dragPos;
      const vx = wasSwipe ? velocity() : 0;
      start = null;
      mode = "pending";
      const cur = latest.current.active;
      if (!wasSwipe) {
        // Caught mid-slide by a tap or a scroll: finish the slide to the pane it was heading for.
        if (caught) settle(cur, settleMs(Math.abs(cur - basePos) * stepPx, 0));
        return;
      }
      const from = Math.round(basePos);
      const dx = (basePos - fingerPos) * stepPx; // finger travel in px; negative = leftwards
      const target = paneAfterSwipe(from, latest.current.last, dx, vx);
      const to = target ?? from;
      const shown = rubberBand(fingerPos, latest.current.last);
      // Pick up from where the finger let go: rewrite the transform there, then animate on.
      pos.current = shown;
      settle(to, settleMs(Math.abs(to - shown) * stepPx, vx));
      // React hears now, not when the slide lands, so the next swipe can start straight away.
      // The slide is a compositor animation, so the re-render does not interrupt it.
      if (to !== cur) setActive(to);
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    // Not passive: once the gesture is a swipe, the page must not also scroll.
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [place, settle, stopAnimations, visiblePos]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = Math.max(0, Math.min(last, active + (e.key === "ArrowRight" ? 1 : -1)));
    setActive(next);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  };
  const id = React.useId();

  const board = tone === "board";
  const n = tabs.length;
  return (
    <div className={className} data-pager>
      <div
        role="tablist"
        aria-label="Sections"
        onKeyDown={onKey}
        data-pager-tabs
        className={cn("group relative mb-3 grid gap-1 rounded-full p-1 lg:hidden", board ? "bg-board-ink/10" : "bg-muted")}
        style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
      >
        <span
          ref={pillEl}
          aria-hidden
          className={cn("absolute bottom-1 left-1 top-1 rounded-full shadow-sm will-change-transform", board ? "bg-board-ink/15" : "bg-card")}
          style={{
            width: `calc((100% - 8px - ${(n - 1) * PILL_GAP_PX}px) / ${n})`,
            transform: pillTransform(Math.min(initial, last)),
          }}
        />
        {tabs.map((t, i) => {
          const on = i === active;
          return (
            <button
              key={t.key}
              id={`${id}-tab-${i}`}
              data-tab
              type="button"
              role="tab"
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(i)}
              className={cn(
                "relative z-10 flex min-h-9 min-w-0 items-center justify-center gap-1 rounded-full px-1 text-[13px] font-medium transition-colors",
                on ? (board ? "text-board-ink" : "text-foreground") : board ? "text-board-dim" : "text-muted-foreground",
                // While a swipe moves the pill, the label it is over is the lit one, not the selected tab's.
                board
                  ? "group-data-[scrubbing=true]:text-board-dim group-data-[scrubbing=true]:data-[lit=true]:text-board-ink"
                  : "group-data-[scrubbing=true]:text-muted-foreground group-data-[scrubbing=true]:data-[lit=true]:text-foreground",
              )}
            >
              <span className="truncate">{t.label}</span>
              {t.count !== undefined && (
                <span className={cn("num shrink-0 rounded-full px-1 text-[11px] leading-[18px]", board ? "bg-board-ink/10" : "bg-muted")}>{t.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* The viewport clips the track on a phone, and is as tall as the pane you are on;
          from lg up it is just a wrapper around the grid. */}
      <div
        ref={viewport}
        className="relative h-[var(--ph,auto)] overflow-clip transition-[height] duration-300 ease-out lg:h-auto lg:overflow-visible"
        style={{ touchAction: "pan-y" }}
      >
        <div
          ref={trackEl}
          // The server renders it already on the chosen pane (via --p), so a pane other
          // than the first does not flash the first one before the script runs.
          className="flex items-start gap-4 will-change-transform max-lg:[transform:translateX(calc(var(--p)*-100%-var(--p)*16px))] lg:grid lg:grid-cols-3 lg:will-change-auto"
          style={{ "--p": Math.min(initial, last) } as React.CSSProperties}
        >
          {panes.map((p, i) => (
            <div
              key={tabs[i]?.key ?? i}
              role="tabpanel"
              aria-label={tabs[i]?.label}
              className="w-full min-w-0 shrink-0 lg:w-auto lg:shrink"
            >
              {p}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
