"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

/*
  The three loading pictures, phone only (every wrapper is lg:hidden).

  There are three loading moments: opening the app, a page that is slow to
  arrive, and signing in. Each page load draws a random order of the three
  pictures and gives every moment a different one, so two moments never show
  the same picture. A single lock means only one loader is ever on screen at a
  time, whichever moment asks first.

  Nothing here is rendered on the server (the picture is chosen after mount),
  so there is no hydration mismatch, and a loader only appears after a short
  delay so a fast page never flashes one.
*/
export type LoaderSlot = "launch" | "route" | "signin";
const SLOTS: LoaderSlot[] = ["launch", "route", "signin"];
const PICTURES = ["/loaders/cat.gif", "/loaders/dino.gif", "/loaders/chai.gif"];

let assignment: Record<LoaderSlot, string> | null = null;
function pictureFor(slot: LoaderSlot) {
  if (!assignment) {
    const order = [...PICTURES];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    assignment = Object.fromEntries(SLOTS.map((s, i) => [s, order[i]])) as Record<LoaderSlot, string>;
  }
  return assignment[slot];
}

let holder: LoaderSlot | null = null; // who is on screen right now

export function MobileLoader({
  slot, active = true, delay = 350, overlay = false, className,
}: {
  slot: LoaderSlot;
  active?: boolean;
  delay?: number;
  overlay?: boolean;
  className?: string;
}) {
  const [src, setSrc] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!active || window.innerWidth >= 1024) { setSrc(null); return; }
    let claimed = false;
    const t = window.setTimeout(() => {
      if (holder && holder !== slot) return; // another loader is up: never two at once
      holder = slot;
      claimed = true;
      setSrc(pictureFor(slot));
    }, delay);
    return () => {
      window.clearTimeout(t);
      if (claimed && holder === slot) holder = null;
    };
  }, [active, slot, delay]);

  if (!src) return null;
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={176} height={176} decoding="async" className="h-44 w-44 rounded-[28px] object-cover shadow-lg" />
  );
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "lg:hidden",
        overlay
          ? "fixed inset-0 z-[80] grid place-items-center bg-background/90 backdrop-blur-sm"
          : "grid min-h-[60dvh] place-items-center",
        className,
      )}
    >
      {img}
    </div>
  );
}

/*
  The first thing on screen when the app is opened: a full-screen loader that
  holds until the page has finished loading (at least a moment, so it reads as
  intentional), then fades. Once per browser session.
*/
export function LaunchSplash() {
  const [phase, setPhase] = React.useState<"off" | "on" | "fading">("off");
  React.useEffect(() => {
    if (window.innerWidth >= 1024) return;
    try { if (sessionStorage.getItem("gc-launched")) return; sessionStorage.setItem("gc-launched", "1"); } catch {}
    setPhase("on");
    const started = performance.now();
    const done = () => {
      const wait = Math.max(0, 1300 - (performance.now() - started));
      window.setTimeout(() => { setPhase("fading"); window.setTimeout(() => setPhase("off"), 300); }, wait);
    };
    if (document.readyState === "complete") done(); else window.addEventListener("load", done, { once: true });
  }, []);
  return phase === "off" ? null : (
    <div className={cn("transition-opacity duration-300", phase === "fading" ? "opacity-0" : "opacity-100")}>
      <MobileLoader slot="launch" delay={0} overlay />
    </div>
  );
}
