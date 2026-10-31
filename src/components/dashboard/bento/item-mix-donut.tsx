import { formatPercent } from "@/lib/money";

// Donut of item-category share, drawn as stacked SVG arcs (design 1a).
type Slice = { category: string; sharePct: number };

const R = 60;
const C = 2 * Math.PI * R; // ≈377, matching the mockup's dash arithmetic
const STROKES = ["hsl(var(--chart-ink))", "hsl(var(--amber))", "hsl(var(--brand))", "hsl(var(--muted-foreground))"];

export function ItemMixDonut({ slices, totalQty }: { slices: Slice[]; totalQty: number }) {
  const top = slices.slice(0, 4);
  let offset = 0;
  const arcs = top.map((s, i) => {
    const len = (s.sharePct / 100) * C;
    const arc = { len, offset, stroke: STROKES[i % STROKES.length] };
    offset += len;
    return arc;
  });

  return (
    <>
      <div className="relative mt-2 grid place-items-center">
        <svg width="150" height="150" viewBox="0 0 150 150">
          <circle cx="75" cy="75" r={R} fill="none" stroke="hsl(var(--muted))" strokeWidth="14" />
          {arcs.map((a, i) => (
            <circle
              key={i}
              cx="75" cy="75" r={R} fill="none"
              stroke={a.stroke} strokeWidth="14" strokeLinecap="round"
              strokeDasharray={`${a.len} ${C}`}
              strokeDashoffset={-a.offset}
              transform="rotate(-90 75 75)"
            />
          ))}
        </svg>
        <div className="absolute text-center">
          <div className="display-num text-3xl font-semibold">{totalQty.toLocaleString()}</div>
          <div className="text-2xs text-muted-foreground">items</div>
        </div>
      </div>
      <div className="mt-3.5 flex flex-wrap justify-between gap-x-3 gap-y-2 text-sm">
        {top.map((s, i) => (
          <span key={s.category} className="flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STROKES[i % STROKES.length] }} />
            <b className="display-num text-lg">{formatPercent(s.sharePct, 0)}</b>
            <span className="text-2xs text-muted-foreground">{s.category}</span>
          </span>
        ))}
      </div>
    </>
  );
}
