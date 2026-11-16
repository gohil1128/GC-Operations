"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, X } from "lucide-react";
import { SettingIcon } from "./settings-icons";
import { cn } from "@/lib/utils";
import { GROUPS, SETTINGS, type SettingsEntry } from "./settings-index";

/** Scroll to a card on this page and light it up briefly so the eye lands on it. */
export function revealSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return false;
  el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  el.classList.remove("settings-flash");
  void el.offsetWidth;
  el.classList.add("settings-flash");
  window.setTimeout(() => el.classList.remove("settings-flash"), 1600);
  return true;
}

/*
  The Settings navigator: a search field over every setting in the app, and the
  same settings as a grouped list when the field is empty. Picking one on this
  page scrolls to its card; one on another Settings page goes there and lands
  on it (SettingsHashReveal handles the arrival).
*/
export function SettingsNavigator({ className }: { className?: string }) {
  const pathname = usePathname();
  const [q, setQ] = React.useState("");
  const query = q.trim().toLowerCase();
  const results = React.useMemo(() => {
    if (!query) return [];
    const words = query.split(/\s+/);
    return SETTINGS.filter((s) => {
      const hay = `${s.label} ${s.hint} ${s.group} ${s.keywords}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [query]);

  const onPick = (e: React.MouseEvent, s: SettingsEntry) => {
    const [path, hash] = s.href.split("#");
    if (hash && path === pathname && revealSection(hash)) {
      e.preventDefault();
      history.replaceState(null, "", `#${hash}`);
    }
  };

  /*
    A row is an icon and a name, nothing else: no tile behind the icon, no
    chevron, no rule under it. The one-line description only appears in search
    results, where it is what tells two matches apart.
  */
  const row = (s: SettingsEntry, showHint = false) => (
    <Link
      key={`${s.label}-${s.href}`}
      href={s.href}
      onClick={(e) => onPick(e, s)}
      className="lg-press flex min-h-11 items-center gap-3.5 rounded-2xl px-3 py-2 hover:bg-muted/60 active:bg-muted/60"
    >
      <SettingIcon name={s.icon ?? s.id} className={cn("shrink-0", s.id === "danger-zone" ? "text-destructive" : "text-brand-ink")} />
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[15px] leading-tight", s.id === "danger-zone" && "text-destructive")}>{s.label}</span>
        {showHint && <span className="mt-0.5 block truncate text-2xs text-muted-foreground">{s.group} · {s.hint}</span>}
      </span>
    </Link>
  );

  return (
    <nav aria-label="Settings" className={cn("space-y-5", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search settings"
          aria-label="Search settings"
          className="h-11 w-full rounded-full border border-input/45 bg-muted/45 pl-10 pr-10 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 [&::-webkit-search-cancel-button]:hidden"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {query ? (
        <div role="region" aria-live="polite" aria-label="Search results">
          {results.length > 0 ? (
            results.map((s) => row(s, true))
          ) : (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nothing in Settings matches &ldquo;{q}&rdquo;.</p>
          )}
        </div>
      ) : (
        GROUPS.map((g) => {
          const items = SETTINGS.filter((s) => s.group === g);
          return (
            <section key={g} aria-label={g}>
              <h2 className="mb-0.5 px-3 text-[11px] font-medium tracking-[0.04em] text-muted-foreground/80">{g}</h2>
              <div>{items.map((s) => row(s))}</div>
            </section>
          );
        })
      )}
    </nav>
  );
}

/** On arriving at a Settings page with #section in the URL, scroll to and light up that card. */
export function SettingsHashReveal() {
  const pathname = usePathname();
  React.useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    const t = window.setTimeout(() => revealSection(id), 120);
    return () => window.clearTimeout(t);
  }, [pathname]);
  return null;
}
