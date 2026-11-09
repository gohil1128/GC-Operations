"use client";
import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronLeft, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

/*
  The two phone gestures people expect from every app (an installed web app
  gets neither from the browser):

    pull down at the top of a page  -> refresh it   (server data re-fetched)
    swipe right from the left edge  -> go back one screen

  Each shows a small round indicator that follows the finger and commits past a
  threshold, so a gesture can be abandoned by easing off. Touch only, phones only,
  never inside a dialog, a menu, a text field or anything that scrolls sideways,
  and off for reduced motion (the gesture still works, without the animation).
*/
const PULL = 70;  // px of (damped) pull to refresh
const BACK = 80;  // px of swipe to go back
const EDGE = 20;  // px from the left edge where a back swipe may start (the tab swipe starts beyond 22)

/* Only in the installed app: a browser tab already has its own pull-to-refresh and
   edge-swipe back, and doing it twice would refresh twice or go back two screens. */
function installed() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    (window as Window & { __gcGestures?: boolean }).__gcGestures === true
  );
}

function blocked(el: EventTarget | null) {
  if (!(el instanceof Element)) return true;
  return !!el.closest("input, textarea, select, [contenteditable=true], [role=dialog], [role=menu], [role=listbox], .more-sheet, [data-no-gesture]");
}

export function GestureNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [pull, setPull] = React.useState(0);
  const [back, setBack] = React.useState(0);
  const [refreshing, startRefresh] = React.useTransition();
  const ref = React.useRef({ pathname, router });
  ref.current = { pathname, router };

  React.useEffect(() => {
    let s: { x: number; y: number; mode: "pull" | "back" | null; locked: boolean } | null = null;
    const small = () => window.innerWidth < 1024 && installed();
    const onStart = (e: TouchEvent) => {
      s = null;
      if (!small() || e.touches.length !== 1 || blocked(e.target)) return;
      const t = e.touches[0];
      const atTop = window.scrollY <= 0;
      const onEdge = t.clientX <= EDGE;
      if (!atTop && !onEdge) return;
      s = { x: t.clientX, y: t.clientY, mode: null, locked: false };
      (s as { atTop?: boolean }).atTop = atTop;
      (s as { onEdge?: boolean }).onEdge = onEdge;
    };
    const onMove = (e: TouchEvent) => {
      if (!s) return;
      const t = e.touches[0];
      const dx = t.clientX - s.x, dy = t.clientY - s.y;
      const st = s as typeof s & { atTop?: boolean; onEdge?: boolean };
      if (!s.locked) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        s.locked = true;
        if (st.onEdge && dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.5) s.mode = "back";
        else if (st.atTop && dy > 0 && Math.abs(dy) > Math.abs(dx) * 1.5 && window.scrollY <= 0) s.mode = "pull";
        else { s = null; return; }
      }
      if (s.mode === "back") {
        if (e.cancelable) e.preventDefault();
        setBack(Math.max(0, Math.min(dx, 140)));
      } else if (s.mode === "pull") {
        if (window.scrollY > 0) { setPull(0); s = null; return; }
        setPull(Math.max(0, Math.min(dy * 0.5, 110)));
      }
    };
    const onEnd = () => {
      if (!s) return;
      const mode = s.mode;
      s = null;
      setPull((p) => {
        if (mode === "pull" && p >= PULL) startRefresh(() => ref.current.router.refresh());
        return 0;
      });
      setBack((b) => {
        if (mode === "back" && b >= BACK) {
          if (window.history.length > 1) ref.current.router.back();
          else ref.current.router.push("/dashboard");
        }
        return 0;
      });
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  const pullShown = pull > 4 || refreshing;
  return (
    <>
      {pullShown && (
        <div
          aria-hidden={!refreshing}
          role={refreshing ? "status" : undefined}
          className="pointer-events-none fixed inset-x-0 top-0 z-[45] flex justify-center lg:hidden"
          style={{ transform: `translateY(calc(env(safe-area-inset-top, 0px) + ${refreshing ? 56 : pull - 8}px))` }}
        >
          <span className="grid h-10 w-10 place-items-center rounded-full bg-card shadow-md ring-1 ring-border-soft">
            <RotateCw
              className={cn("h-[18px] w-[18px]", refreshing ? "animate-spin text-brand-ink" : pull >= PULL ? "text-brand-ink" : "text-muted-foreground")}
              style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)` }}
            />
            {refreshing && <span className="sr-only">Refreshing</span>}
          </span>
        </div>
      )}
      {back > 4 && (
        <div aria-hidden className="pointer-events-none fixed left-0 top-1/2 z-[45] -translate-y-1/2 lg:hidden" style={{ transform: `translate(${Math.min(back - 40, 24)}px, -50%)` }}>
          <span className={cn("grid h-10 w-10 place-items-center rounded-full bg-card shadow-md ring-1 ring-border-soft", back >= BACK ? "text-brand-ink" : "text-muted-foreground")}>
            <ChevronLeft className="h-5 w-5" />
          </span>
        </div>
      )}
    </>
  );
}
