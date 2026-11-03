"use client";
import * as React from "react";

/*
  A figure that counts up to itself when it first appears: "+$55,295.14"
  rolls from $0 in about two thirds of a second.

  It takes the already-formatted string, so every caller keeps its own money
  formatting: only the number inside is animated, with the same commas and
  decimals, and the prefix and suffix ("+$", "%") stay put. The server renders
  the final figure, so there is nothing wrong to see without JavaScript, and
  the page's own fade-in covers the first frame. Off for reduced motion, and
  screen readers only ever hear the real value.
*/
const NUM = /\d[\d,]*(?:\.\d+)?/;

export function CountUp({ value, ms = 700, className }: { value: string; ms?: number; className?: string }) {
  const [shown, setShown] = React.useState(value);
  React.useEffect(() => {
    const m = NUM.exec(value);
    if (!m || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(value); return; }
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
      setShown(before + fmt.format(target * eased) + after);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return (
    <span className={className}>
      <span aria-hidden>{shown}</span>
      <span className="sr-only">{value}</span>
    </span>
  );
}
