"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

/*
  A section that folds open and shut, height and all (.fold in globals.css).

  Closed, it is `hidden` — display:none, exactly as before — so its contents
  cost nothing to style or lay out. A Reports page has a dozen of these, each
  with a ten-row breakdown inside; keeping them all rendered at zero height
  (which is what animating from 0fr alone would do) doubled the page's style
  work every time it arrived.

  Opening: take it out of `hidden`, make the browser compute its style while
  it is still closed (reading offsetHeight forces that), and only then flip it
  open — that is what lets the height transition run from zero. This does not
  count frames: on a slow phone React can batch "show" and "expand" into one
  commit, the browser never sees the closed state, and the section would just
  appear. Closing: collapse, then put `hidden` back once the collapse has played.

  The region carries `print-show`, which the print stylesheet forces open, so a
  printed P&L has every breakdown open whatever was folded on screen.
*/
const CLOSE_MS = 300; // a little over the collapse (280ms), so it is never cut short

export function Fold({
  open,
  id,
  className,
  children,
}: {
  open: boolean;
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = React.useState(open);

  // 1. Asked to open: put it in the page (closed). Asked to close: after the
  //    collapse has played, take it out again.
  React.useEffect(() => {
    if (open) {
      setRendered(true);
      return;
    }
    const t = window.setTimeout(() => setRendered(false), CLOSE_MS);
    return () => window.clearTimeout(t);
  }, [open]);

  // 2. In the page and wanted open: style it closed first, then open it.
  //    `data-open` is written to the element directly (React never renders it),
  //    so it can be flipped exactly between two style computations.
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && rendered) {
      void el.offsetHeight;
      el.dataset.open = "true";
    } else if (!open) {
      el.dataset.open = "false";
    }
  }, [open, rendered]);

  return (
    <div ref={ref} id={id} hidden={!rendered} className={cn("fold print-show", className)}>
      <div className="fold-inner">{children}</div>
    </div>
  );
}
