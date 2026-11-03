"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

/*
  Panes you swipe between, with a tab strip that follows your finger.

  On a phone a three-column board is three screens tall; here each column is a
  full-width pane and you swipe sideways between them, like the To do /
  In progress / Done board in the reference recording. The highlight behind
  the tab labels is one pill that is positioned FROM the scroll position, so it
  glides in step with the swipe instead of jumping when the swipe ends.

  It is plain CSS scroll-snap doing the swiping — native momentum, rubber-band
  and the browser's own gesture handling, no touch code to fight the page's
  vertical scroll. Tapping a tab scrolls to its pane. From `lg` up the panes
  are laid out side by side as an ordinary grid and the strip is hidden.

  Props: one tab per pane, in order. `initial` picks the pane shown first.
*/

export type PagerTab = { key: string; label: string; count?: number };

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
  const scroller = React.useRef<HTMLDivElement>(null);
  const strip = React.useRef<HTMLDivElement>(null);
  const pill = React.useRef<HTMLSpanElement>(null);
  const [active, setActive] = React.useState(initial);

  // Where the pill goes for a fractional pane position (1.4 = 40% of the way to pane 2).
  const place = React.useCallback((pos: number) => {
    const el = strip.current;
    const p = pill.current;
    if (!el || !p) return;
    const btns = Array.from(el.querySelectorAll<HTMLElement>("[data-tab]"));
    if (!btns.length) return;
    const lo = Math.max(0, Math.min(btns.length - 1, Math.floor(pos)));
    const hi = Math.min(btns.length - 1, lo + 1);
    const t = Math.max(0, Math.min(1, pos - lo));
    const x = btns[lo].offsetLeft + (btns[hi].offsetLeft - btns[lo].offsetLeft) * t;
    const w = btns[lo].offsetWidth + (btns[hi].offsetWidth - btns[lo].offsetWidth) * t;
    p.style.transform = `translateX(${x}px)`;
    p.style.width = `${w}px`;
  }, []);

  const position = React.useCallback(() => {
    const s = scroller.current;
    if (!s || s.children.length < 2) return 0;
    const stride = (s.children[1] as HTMLElement).offsetLeft - (s.children[0] as HTMLElement).offsetLeft;
    return stride > 0 ? s.scrollLeft / stride : 0;
  }, []);

  // Start on the chosen pane, with the pill already under it (no slide-in on load).
  React.useLayoutEffect(() => {
    const s = scroller.current;
    if (!s) return;
    const stride = s.children.length > 1 ? (s.children[1] as HTMLElement).offsetLeft - (s.children[0] as HTMLElement).offsetLeft : 0;
    s.scrollLeft = stride * initial;
    place(initial);
    const ro = new ResizeObserver(() => place(position()));
    ro.observe(s);
    return () => ro.disconnect();
  }, [initial, place, position]);

  // The scroller is only as tall as the pane you are on, so a short column is
  // not followed by the empty height of the tallest one. Height eases between
  // panes; from lg up the panes sit side by side and this does not apply.
  React.useLayoutEffect(() => {
    const s = scroller.current;
    const pane = s?.children[active] as HTMLElement | undefined;
    if (!s || !pane) return;
    const apply = () => s.style.setProperty("--ph", `${pane.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(pane);
    return () => ro.disconnect();
  }, [active]);

  const raf = React.useRef(0);
  const onScroll = () => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const pos = position();
      place(pos);
      setActive(Math.max(0, Math.min(tabs.length - 1, Math.round(pos))));
    });
  };

  const go = (i: number) => {
    const s = scroller.current;
    if (!s || s.children.length < 2) return;
    const stride = (s.children[1] as HTMLElement).offsetLeft - (s.children[0] as HTMLElement).offsetLeft;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    s.scrollTo({ left: stride * i, behavior: reduce ? "auto" : "smooth" });
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = Math.max(0, Math.min(tabs.length - 1, active + (e.key === "ArrowRight" ? 1 : -1)));
    go(next);
    strip.current?.querySelectorAll<HTMLElement>("[data-tab]")[next]?.focus();
  };

  const board = tone === "board";
  return (
    <div className={className}>
      <div
        ref={strip}
        role="tablist"
        aria-label="Sections"
        onKeyDown={onKey}
        className={cn("relative mb-3 flex gap-1 rounded-full p-1 lg:hidden", board ? "bg-board-ink/10" : "bg-muted")}
      >
        <span
          ref={pill}
          aria-hidden
          className={cn("absolute inset-y-1 left-0 rounded-full shadow-sm", board ? "bg-board-ink/15" : "bg-card")}
          style={{ width: 0 }}
        />
        {tabs.map((t, i) => {
          const on = i === active;
          return (
            <button
              key={t.key}
              data-tab
              type="button"
              role="tab"
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              onClick={() => go(i)}
              className={cn(
                "relative z-10 flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-[13px] font-medium transition-colors duration-200",
                on ? (board ? "text-board-ink" : "text-foreground") : board ? "text-board-dim" : "text-muted-foreground",
              )}
            >
              <span className="truncate">{t.label}</span>
              {t.count !== undefined && (
                <span className={cn("num rounded-full px-1.5 text-[11px] leading-[18px]", board ? "bg-board-ink/10" : "bg-muted")}>{t.count}</span>
              )}
            </button>
          );
        })}
      </div>

      <div
        ref={scroller}
        onScroll={onScroll}
        className="no-scrollbar -mx-1 flex h-[var(--ph,auto)] snap-x snap-mandatory items-start gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain px-1 transition-[height] duration-300 ease-out lg:mx-0 lg:grid lg:h-auto lg:grid-cols-3 lg:gap-4 lg:overflow-visible lg:px-0"
      >
        {panes.map((p, i) => (
          <div
            key={tabs[i]?.key ?? i}
            role="tabpanel"
            aria-label={tabs[i]?.label}
            className="w-full min-w-full shrink-0 snap-center snap-always lg:min-w-0 lg:w-auto"
          >
            {p}
          </div>
        ))}
      </div>
    </div>
  );
}
