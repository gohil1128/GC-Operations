import * as React from "react";

/*
  A horizontal swipe on an element, as two callbacks.

  It only counts a gesture that is clearly sideways — at least `min` px, and
  more than twice as far across as up or down — so scrolling the page, which
  is almost always a bit diagonal, never triggers it. Touch only: a mouse has
  a button for everything these gestures do.

  Do not put it on something that itself scrolls sideways (a chip strip, a
  wide table), or the two will fight; the pager uses native scroll-snap for
  that case instead.
*/
export function useSwipe({ onLeft, onRight, min = 56 }: { onLeft?: () => void; onRight?: () => void; min?: number }) {
  const start = React.useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (Math.abs(dx) < min || Math.abs(dx) < Math.abs(dy) * 2) return;
      if (dx < 0) onLeft?.(); else onRight?.();
    },
  };
}
