import { cn } from "@/lib/utils";

/*
  The KPI strip: four figures in one ruled band, opened by a heavy rule in the
  logo brown and closed by a hairline. Cells are divided rather than boxed, so
  the row reads as one statement heading instead of four separate cards.

  Below `lg` four columns would each be ~80px wide, which the display numerals
  can't survive, so it drops to two and the dividers rearrange to match. The
  nth-child variants keep whichever cell starts a row flush with the page
  margin at both counts.
*/

export type Kpi = {
  label: string;
  value: string;
  sub: React.ReactNode;
  tone?: "muted" | "success" | "danger" | "brand";
};

const TONE = {
  muted: "text-muted-foreground",
  success: "text-success",
  danger: "text-destructive",
  brand: "text-brand-ink",
} as const;

export function KpiStrip({ items }: { items: Kpi[] }) {
  const last = items.length - 1;
  return (
    /*
      A frosted panel, not a bare ruled band. The strip sits inside the
      photograph band now, and dark figures straight on the photo were
      unreadable — the handoff specifies this same glass treatment for it.
    */
    <div className="bento mt-7 grid grid-cols-2 overflow-hidden lg:grid-cols-4">
      {items.map((k, i) => (
        <div
          key={k.label}
          className={cn(
            "min-w-0 border-input px-4 py-4 sm:px-5 sm:py-[18px]",
            // Dividers: vertical between columns, horizontal only while wrapped.
            i % 2 === 0 && "border-r",
            i < last - 1 && "border-b",
            "lg:border-b-0",
            i !== last && "lg:border-r",
          )}
        >
          <div className="text-xs text-muted-foreground">{k.label}</div>
          <div className="display-num mt-2 truncate text-[30px] font-medium leading-[1.05] sm:text-[36px] lg:text-[42px]">
            {k.value}
          </div>
          <div className={cn("mt-1.5 text-xs", TONE[k.tone ?? "muted"])}>{k.sub}</div>
        </div>
      ))}
    </div>
  );
}
