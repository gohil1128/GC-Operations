"use client";
import * as React from "react";
import { usePathname } from "next/navigation";
import { markNavigation, takeNavigationKind } from "@/lib/nav-kind";

/*
  The page's entrance, played when you tap your way to a new screen.

  It is skipped when the change has already been animated for you: a tab swipe
  (the next screen slid in under your finger and the real page is swapped in
  behind it) and the browser's own back/forward gesture (it has just drawn the
  previous screen sliding back). Fading the page in again on top of either is
  the second, laggy-looking animation. See lib/nav-kind.ts.
*/
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Decided once per route change, during the render that first sees the new
  // path, so the entrance class is right on the very first paint of the page.
  const seen = React.useRef(pathname);
  const calm = React.useRef(false);
  if (seen.current !== pathname) {
    seen.current = pathname;
    calm.current = takeNavigationKind() !== null;
  }

  // The browser's back/forward gesture raises popstate before the page changes.
  React.useEffect(() => {
    const onPop = () => markNavigation("history");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return (
    <div key={pathname} className={calm.current ? undefined : "animate-page"} data-calm={calm.current ? "" : undefined}>
      {children}
    </div>
  );
}
