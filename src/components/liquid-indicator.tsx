"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

/*
  The travelling selection indicator — the signature Liquid Glass interaction.

  A nav that marks its current item by turning that item's background on, and
  the previous one's off, CROSS-FADES. Two things change opacity in place and
  nothing moves. Liquid Glass does the opposite: one object travels, and on the
  way it behaves like a droplet being pulled — it elongates along the direction
  of travel, then recovers when it arrives.

  So this is a single element per nav, positioned over whichever item is
  current, rather than a style on each item. It measures rather than guesses,
  because the items are not a fixed size in every nav that uses it and a hard
  coded step would drift the moment one is added.

  TWO ELEMENTS, not one, and that is the only subtle part of the markup. The
  travel is a spring on `transform: translate`, and the stretch is a scale that
  has to peak mid-flight and return — two different curves on the same
  property, which one element cannot express. The outer element translates, the
  inner one scales, and the inner is re-keyed on each move so its animation
  restarts rather than being ignored as already-running.

  IT FINDS ITS OWN CONTAINER, which is not the obvious design and is the
  correct one. The obvious design takes a ref to the nav. That does not work:
  React attaches a parent's ref during the same commit pass that runs its
  children's layout effects, children first — so on mount this component's
  effect sees `null` and, because a ref object's identity never changes, the
  effect has no reason to run again. The indicator simply never appeared on a
  fresh page load, and only showed up after a client-side navigation forced a
  re-render. Measuring against its own parentElement removes the ordering
  question entirely: by the time a layout effect runs, the element is in the
  document and its parent is reachable.
*/

type Axis = "x" | "y";

export function LiquidIndicator({
  activeKey,
  activeSelector,
  axis = "y",
  className,
}: {
  /** Changes when the selection changes. Null hides the indicator. */
  activeKey?: string | null;
  /*
    An alternative to activeKey, for a nav whose selection this component
    cannot be told about. Radix Tabs marks the current trigger with
    data-state="active" and keeps that state to itself, so there is no value
    for the list to pass down — the indicator has to watch the DOM instead.
  */
  activeSelector?: string;
  axis?: Axis;
  className?: string;
}) {
  const selfRef = React.useRef<HTMLSpanElement>(null);
  const [box, setBox] = React.useState<{ x: number; y: number; w: number; h: number } | null>(null);
  /* How hard to stretch, and a key that restarts the stretch animation. Both
     are derived from the move itself: a jump across the whole rail deserves
     more distortion than a step to the neighbour. */
  const [travel, setTravel] = React.useState({ amp: 1, key: 0 });
  const previous = React.useRef<{ x: number; y: number } | null>(null);

  /*
    Measured in a layout effect, before paint. In a passive effect the
    indicator would be painted at its old position for one frame on every
    navigation — a visible flick back to where it used to be.
  */
  React.useLayoutEffect(() => {
    const host = selfRef.current?.parentElement;
    const selector =
      activeSelector ?? (activeKey ? `[data-lg-item="${CSS.escape(activeKey)}"]` : null);
    if (!host || !selector) {
      setBox(null);
      previous.current = null;
      return;
    }

    const measure = () => {
      /* Re-resolved on every measure rather than captured once: under
         activeSelector the element that matches IS the thing that changes, so
         a closed-over reference would keep measuring whichever tab happened to
         be active when the effect first ran. */
      const el = host.querySelector<HTMLElement>(selector);
      if (!el) {
        setBox(null);
        return;
      }
      const hb = host.getBoundingClientRect();
      const eb = el.getBoundingClientRect();
      /* A hidden container measures as a zero box — the mobile tab bar is in
         the document at every width and merely display:none above the lg
         breakpoint. Positioning against that would park an indicator at the
         origin, so an unlaid-out host means no indicator at all. */
      if (hb.width === 0 && hb.height === 0) {
        setBox(null);
        return;
      }
      const next = {
        x: eb.left - hb.left + host.scrollLeft,
        y: eb.top - hb.top + host.scrollTop,
        w: eb.width,
        h: eb.height,
      };

      const from = previous.current;
      if (from) {
        const dist = axis === "y" ? Math.abs(next.y - from.y) : Math.abs(next.x - from.x);
        const span = axis === "y" ? hb.height : hb.width;
        /* Capped at a third. Past that the pill stops reading as a stretched
           droplet and starts reading as a bar that briefly broke. */
        const amp = 1 + Math.min(0.34, (dist / Math.max(span, 1)) * 0.9);
        if (dist > 1) setTravel((t) => ({ amp, key: t.key + 1 }));
      }
      previous.current = { x: next.x, y: next.y };
      setBox(next);
    };

    measure();

    /*
      Observing the host rather than listening for resize: it also catches a
      sibling appearing or disappearing, and a stale indicator left behind a
      moved item is worse than no indicator.
    */
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    const first = host.querySelector<HTMLElement>(selector);
    if (first) ro.observe(first);

    /*
      Under activeSelector nothing re-renders this component when the selection
      moves — the change is an attribute on a sibling, which React never sees.
      So watch for it directly.
    */
    let mo: MutationObserver | undefined;
    if (activeSelector) {
      mo = new MutationObserver(measure);
      mo.observe(host, { attributes: true, subtree: true, attributeFilter: ["data-state"] });
    }
    return () => {
      ro.disconnect();
      mo?.disconnect();
    };
  }, [activeKey, activeSelector, axis]);

  return (
    <span
      ref={selfRef}
      aria-hidden
      className="lg-indicator"
      /* Always rendered, never conditionally returned: this element is how the
         component finds its container, so removing it when there is nothing to
         show would also remove its only way back. Hidden by opacity instead. */
      style={
        box
          ? { transform: `translate3d(${box.x}px, ${box.y}px, 0)`, width: box.w, height: box.h }
          : { opacity: 0, width: 0, height: 0 }
      }
    >
      {box && (
        <span
          key={travel.key}
          className={cn("lg-indicator-skin", className)}
          style={{ ["--lg-amp" as string]: travel.amp }}
          data-axis={axis}
        />
      )}
    </span>
  );
}
