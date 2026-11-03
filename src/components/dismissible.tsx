"use client";
import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/*
  An alert you can close: tap the ×, or swipe it sideways away.

  "Close" means "I have seen this and dealt with it, or I choose to live with
  it", so the choice is remembered on this device. It is remembered against
  `id`, and the id carries what the alert is ABOUT (which day, how many
  invoices) — so when the situation changes, say a second day goes uncounted,
  the id changes and the alert comes back instead of staying buried.

  Nothing is deleted or settled in the data: this only hides the notice. The
  fix it points at (Close drawer, the flagged invoices) is still where it was.

  It renders open on the server and hides itself after load if it was closed,
  so a closed alert can flash for a frame on a slow connection; the alternative,
  rendering closed until storage has been read, would make every open alert
  pop in late instead.
*/

const KEY = "dismissed-alerts";
const read = (): string[] => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]; } catch { return []; }
};
const write = (ids: string[]) => {
  try { localStorage.setItem(KEY, JSON.stringify(ids.slice(-60))); } catch { /* private mode: it just comes back next visit */ }
};

export function Dismissible({
  id, children, className, spacing = "pt-4", label = "Dismiss",
}: {
  id: string;
  children: React.ReactNode;
  /** Classes for the alert's own box. */
  className?: string;
  /** Space above, inside the collapsing wrapper so it closes up with the alert. */
  spacing?: string;
  label?: string;
}) {
  const [gone, setGone] = React.useState(false);
  const [dx, setDx] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const start = React.useRef<{ x: number; y: number; lock: boolean | null } | null>(null);
  const box = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => { if (read().includes(id)) setGone(true); }, [id]);

  const close = (dir = 1) => {
    write([...read().filter((x) => x !== id), id]);
    const w = box.current?.offsetWidth ?? 320;
    setDragging(false);
    setDx(dir * w);
    window.setTimeout(() => setGone(true), 180);
  };

  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("a,button")) return;
    start.current = { x: e.clientX, y: e.clientY, lock: null };
  };
  const onMove = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s) return;
    const mx = e.clientX - s.x;
    const my = e.clientY - s.y;
    if (s.lock === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) s.lock = Math.abs(mx) > Math.abs(my) * 1.5;
    if (s.lock) {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      setDragging(true);
      setDx(mx);
    }
  };
  const onUp = () => {
    const s = start.current;
    start.current = null;
    if (!s?.lock) return;
    const w = box.current?.offsetWidth ?? 320;
    if (Math.abs(dx) > Math.min(110, w * 0.3)) close(Math.sign(dx) || 1);
    else { setDragging(false); setDx(0); }
  };

  return (
    <div
      className={cn("dismiss-wrap grid transition-[grid-template-rows,opacity] duration-300 ease-out", gone ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr]")}
      aria-hidden={gone || undefined}
    >
      <div className="min-h-0 overflow-hidden">
        <div className={spacing}>
          <div
            ref={box}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            style={{ transform: `translateX(${dx}px)`, opacity: Math.max(0.25, 1 - Math.abs(dx) / 260), touchAction: "pan-y" }}
            className={cn("relative flex items-center", dragging ? "" : "transition-[transform,opacity] duration-200 ease-out", className)}
          >
            {children}
            <button
              type="button"
              onClick={() => close(1)}
              aria-label={label}
              className="lg-press relative -mr-1 ml-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-current opacity-60 hover:opacity-100 after:absolute after:-inset-1.5 after:content-['']"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
