"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { cn } from "@/lib/utils";
import { bestPage, hubsFor } from "./nav";

/*
  The pages inside a hub (Stock, Staff, Settings), as a strip of tabs at the
  top of the section. Phone only: on a computer the sidebar already lists
  every page.

  The highlight is one pill that slides to the tab you picked rather than
  each tab lighting up on its own, so moving between Counts and Variance
  feels like moving along one control. Its position is measured from the
  tabs themselves, and it only animates after the first paint, so it never
  slides in from the left on load.
*/
export function SectionTabs({ hub, role }: { hub: string; role: Role }) {
  const pathname = usePathname();
  const h = hubsFor(role).find((x) => x.key === hub);
  const pages = h?.pages ?? [];
  const current = bestPage(pathname, pages);

  const wrap = React.useRef<HTMLDivElement>(null);
  const [pill, setPill] = React.useState<{ x: number; w: number } | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useLayoutEffect(() => {
    const el = wrap.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!el) { setPill(null); return; }
    setPill({ x: el.offsetLeft, w: el.offsetWidth });
    // Keep the chosen tab in view on a narrow phone.
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [current?.href]);
  React.useEffect(() => { const t = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(t); }, []);

  /*
    Swipe the page to move to the next or previous tab of this section — the
    same gesture as the tab strip itself.

    It is a document-level listener, so it has to be careful not to steal a
    swipe that belongs to something else: a table or chip strip that scrolls
    sideways, a form control, a dialog, or a pager. Any of those under the
    finger, and it stays out. The movement must also be clearly sideways and
    long (72px, twice as far across as down), so ordinary scrolling and taps
    never trip it. Touch only.
  */
  const router = useRouter();
  const idx = pages.findIndex((p) => p.href === current?.href);
  React.useEffect(() => {
    if (pages.length < 2 || idx < 0) return;
    let s: { x: number; y: number; ok: boolean } | null = null;
    const blocked = (el: Element | null) => {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        const h = n as HTMLElement;
        if (h.matches('input,select,textarea,[role="dialog"],[role="tablist"],[data-no-swipe]')) return true;
        const ox = getComputedStyle(h).overflowX;
        if ((ox === "auto" || ox === "scroll") && h.scrollWidth > h.clientWidth + 1) return true;
      }
      return false;
    };
    const down = (e: TouchEvent) => {
      const t = e.touches[0];
      s = { x: t.clientX, y: t.clientY, ok: e.touches.length === 1 && !blocked(e.target as Element) };
    };
    const up = (e: TouchEvent) => {
      const st = s; s = null;
      if (!st?.ok) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - st.x, dy = t.clientY - st.y;
      if (Math.abs(dx) < 72 || Math.abs(dx) < Math.abs(dy) * 2) return;
      const next = pages[idx + (dx < 0 ? 1 : -1)];
      if (next) router.push(next.href);
    };
    document.addEventListener("touchstart", down, { passive: true });
    document.addEventListener("touchend", up, { passive: true });
    return () => { document.removeEventListener("touchstart", down); document.removeEventListener("touchend", up); };
  }, [pages, idx, router]);

  if (pages.length < 2) return null;

  return (
    <nav aria-label={`${h?.label ?? ""} pages`} className="mx-auto max-w-[1400px] px-4 pt-3 sm:px-6 lg:hidden">
      <div ref={wrap} className="no-scrollbar relative flex gap-1 overflow-x-auto rounded-full bg-muted p-1">
        {pill && (
          <span
            aria-hidden
            className={cn("absolute inset-y-1 left-0 rounded-full bg-card shadow-sm", ready && "section-pill")}
            style={{ width: pill.w, transform: `translateX(${pill.x}px)` }}
          />
        )}
        {pages.map((p) => {
          const on = p.href === current?.href;
          return (
            <Link
              key={p.href}
              href={p.href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "relative z-10 min-h-9 flex-1 whitespace-nowrap rounded-full px-3.5 text-center text-[13px] font-medium leading-9 transition-colors duration-200",
                on ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
