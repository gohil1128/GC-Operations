"use client";
import * as React from "react";
import { usePathname } from "next/navigation";
import { pageNavigationTarget } from "@/lib/page-link";

/*
  A hairline at the top of the screen while the next page is being fetched.

  The app used to swap the current page for a grey skeleton the instant you
  tapped, then swap that for the real page: two jumps, and the first one threw
  away content you were still looking at. Now the page you are on stays put
  until the next one is ready, and this line (plus the tapped tab lighting up)
  says the tap was heard.

  It starts on any click that opens another screen of this app, or when a tab
  swipe starts a navigation (the "gc:navigating" event), and finishes when the
  address changes to where it was headed. Next does not expose a global
  "navigating" flag, so the address is polled while the line is running — a
  string compare every 80ms, for a second or so.

  The line is a transform and an opacity: it never causes layout.
*/

const GIVE_UP_MS = 8000;
type Phase = "idle" | "run" | "done";

export function RouteProgress() {
  const pathname = usePathname();
  const [phase, setPhase] = React.useState<Phase>("idle");
  const target = React.useRef<string | null>(null);
  const timers = React.useRef<{ poll?: number; stop?: number; fade?: number }>({});

  const finish = React.useCallback(() => {
    const t = timers.current;
    window.clearInterval(t.poll);
    window.clearTimeout(t.stop);
    target.current = null;
    setPhase((p) => (p === "run" ? "done" : p));
    window.clearTimeout(t.fade);
    t.fade = window.setTimeout(() => setPhase("idle"), 420);
  }, []);

  const begin = React.useCallback(
    (to: string) => {
      const t = timers.current;
      window.clearInterval(t.poll);
      window.clearTimeout(t.stop);
      window.clearTimeout(t.fade);
      target.current = to;
      setPhase("run");
      t.poll = window.setInterval(() => {
        if (target.current && location.pathname + location.search === target.current) finish();
      }, 80);
      t.stop = window.setTimeout(finish, GIVE_UP_MS);
    },
    [finish],
  );

  React.useEffect(() => {
    // The timers object is mutated in place, never replaced, so this is the
    // same object the cleanup below needs.
    const t = timers.current;
    // Bubble phase on document: by now Next's Link has had its say, and
    // anything that is not a real page change has already been filtered out.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const to = pageNavigationTarget(
        { href: a.href, target: a.target, download: a.hasAttribute("download") },
        e,
        new URL(location.href),
      );
      if (to) begin(to);
    };
    const onNavigating = (e: Event) => {
      const to = (e as CustomEvent<string>).detail;
      if (typeof to === "string") begin(to);
    };
    document.addEventListener("click", onClick);
    window.addEventListener("gc:navigating", onNavigating);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("gc:navigating", onNavigating);
      window.clearInterval(t.poll);
      window.clearTimeout(t.stop);
      window.clearTimeout(t.fade);
    };
  }, [begin]);

  // The page changed (even if the address compare missed it): done.
  React.useEffect(() => {
    if (target.current) finish();
  }, [pathname, finish]);

  return <div aria-hidden className="route-progress" data-phase={phase} />;
}
