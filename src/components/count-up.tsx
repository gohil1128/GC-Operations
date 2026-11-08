"use client";
import * as React from "react";

/*
  A figure that counts up to itself when it first appears: "+$55,295.14"
  rolls from $0 in about half a second.

  It takes the already-formatted string, so every caller keeps its own money
  formatting: only the number inside is animated, with the same commas and
  decimals, and the prefix and suffix ("+$", "%") stay put. The server renders
  the final figure, so there is nothing wrong to see without JavaScript.
  Screen readers only ever hear the real value.

  Two things keep it from adding to a page's load:
    - The digits are written straight to the text node each frame instead of
      through React state, so a count costs no renders (it used to re-render
      the component ~40 times while the page's own entrance was running).
    - It does not play when the screen was already animated in for you (a tab
      swipe or the back gesture; see PageTransition's data-calm). The page you
      swiped to already shows the final figure, so counting up from $0 under
      it would make the number jump backwards and roll again.
  Off for reduced motion, too.
*/
const NUM = /\d[\d,]*(?:\.\d+)?/;

export function CountUp({ value, ms = 520, className }: { value: string; ms?: number; className?: string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const m = NUM.exec(value);
    if (!m || window.matchMedia("(prefers-reduced-motion: reduce)").matches || el.closest("[data-calm]")) {
      el.textContent = value;
      return;
    }
    const target = Number(m[0].replace(/,/g, ""));
    const decimals = m[0].includes(".") ? m[0].split(".")[1].length : 0;
    const fmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: m[0].includes(",") || target >= 1000 });
    const before = value.slice(0, m.index);
    const after = value.slice(m.index + m[0].length);
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = p < 1 ? before + fmt.format(target * eased) + after : value;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.textContent = value;
    };
  }, [value, ms]);
  return (
    <span className={className}>
      <span aria-hidden ref={ref}>{value}</span>
      <span className="sr-only">{value}</span>
    </span>
  );
}
