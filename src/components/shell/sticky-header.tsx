import * as React from "react";

/*
  The app's top strip, as a scroll edge.

  Nothing is cut across the page. The strip carries a frosted veil that is
  strongest at the top, behind the clock and the buttons, and fades to nothing
  below them (.top-veil in globals.css), so text scrolling up under it blurs and
  dissolves rather than meeting a hard line — the way the iOS bars do.

  At the top of a page there is nothing under it, and the veil is the page's own
  top colour (--page-top, the value the page gradient starts from), so it cannot
  be seen at all. It used to switch from clear to a solid bar when the page
  moved under it, which needed an observer and a re-render and still ended in a
  visible edge; the veil needs neither.

  The safe-area padding is inside the strip, so the veil also covers the status
  bar of a standalone app, where page text used to run up under the clock.
*/
export function StickyHeader({ children }: { children: React.ReactNode }) {
  return <header className="top-veil sticky top-0 z-30 pt-safe">{children}</header>;
}
