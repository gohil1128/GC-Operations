import { fmtDate } from "@/lib/date";

/*
  The last few runs of a sync or scan, folded away under its card: when, who
  started it, what it did, and any error. Counts only.
*/
export type RunRow = {
  id: string;
  at: Date;
  trigger: string;
  summary: string;
  error?: string | null;
  partial?: boolean;
};

export function RunHistory({ title, runs, empty }: { title: string; runs: RunRow[]; empty: string }) {
  return (
    <details className="group rounded-2xl bg-muted/40">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <span>
          {title}
          <span className="ml-2 text-2xs font-normal text-muted-foreground">{runs.length ? `last ${runs.length}` : "none yet"}</span>
        </span>
        <span aria-hidden className="text-xs text-brand-ink group-open:hidden">Show</span>
        <span aria-hidden className="hidden text-xs text-brand-ink group-open:inline">Hide</span>
      </summary>
      {runs.length === 0 ? (
        <p className="px-4 pb-3 text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border-soft px-4 pb-2">
          {runs.map((r) => (
            <li key={r.id} className="flex items-baseline justify-between gap-3 py-2 text-xs">
              <span className="min-w-0">
                <span className="block text-foreground">
                  {r.error ? <span className="text-destructive">{r.error}</span> : r.summary}
                  {r.partial && !r.error && <span className="text-muted-foreground"> · more to do</span>}
                </span>
                <span className="text-muted-foreground">{r.trigger === "cron" ? "Automatic" : "You pressed it"}</span>
              </span>
              <span className="num shrink-0 text-muted-foreground">{fmtDate(r.at, "MMM d, h:mm a")}</span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
