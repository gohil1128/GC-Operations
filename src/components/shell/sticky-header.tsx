"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

/*
  The app's top strip: transparent at rest, solid once content passes under it.

  It was always transparent, because it used to float over a photograph and
  carry its own frosted pills. The photograph is gone, and a sticky header
  with no background of its own just lets whatever scrolls up behind it show
  through — on a phone the logo and the account button ended up drawn over the
  filter chips, and in a standalone PWA the page text ran up under the clock
  and signal bars, because the safe-area padding above the header was
  transparent too.

  Solid all the time would fix that and cost the thing the reference gets
  right: at the top of the screen the page is lit from above and the header
  should be part of that light, not a bar cut across it. So it is clear at
  rest and takes the page's own colour (--page-top, the same value the
  gradient starts from) only once it is actually covering something.

  A 1px sentinel above it, watched by an IntersectionObserver, says when it has
  left the viewport — no scroll listener, nothing running per frame.
*/
export function StickyHeader({ children }: { children: React.ReactNode }) {
  const sentinel = React.useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = React.useState(false);

  React.useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinel} aria-hidden className="pointer-events-none -mb-px h-px w-full" />
      <header
        data-stuck={stuck}
        className={cn(
          // No bar at all: once content is under it, a frosted fade (see
          // .header-fade in globals.css) blurs what scrolls beneath and melts
          // away toward the page, and the controls float on it as glass circles.
          "header-fade sticky top-0 z-30 pt-safe",
        )}
      >
        {children}
      </header>
    </>
  );
}
