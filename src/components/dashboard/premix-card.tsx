import Link from "next/link";
import { Package } from "lucide-react";
import { formatMoney } from "@/lib/money";
import type { PremixSummary } from "@/modules/sales/premix";

const qty = (n: number) => (Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1));

/*
  Premix on Home: every bag sold, across all events, whatever event the page
  is set to. One line of totals and the best flavours under it.
*/
export function PremixCard({ data }: { data: PremixSummary }) {
  const top = data.flavours.slice(0, 4);
  const max = Math.max(1, ...top.map((f) => f.netSalesCents));
  return (
    <section aria-labelledby="premix-h" className="rounded-[28px] bg-card p-5">
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-muted text-brand-ink">
          <Package className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="premix-h" className="text-sm font-semibold">Premix</h2>
          <p className="text-xs text-muted-foreground">
            All events · {data.days} day{data.days === 1 ? "" : "s"}
            {data.events > 0 && <> · {data.events} event{data.events === 1 ? "" : "s"}</>}
          </p>
        </div>
        <Link href="/sales?category=Premix" className="shrink-0 text-xs font-medium text-brand-ink">See items</Link>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div>
          <div className="text-[11px] text-muted-foreground">Sales</div>
          <div className="display-num text-[22px] font-medium leading-tight tabular-nums">{formatMoney(data.netSalesCents)}</div>
        </div>
        <div>
          <div className="text-[11px] text-muted-foreground">Bags</div>
          <div className="display-num text-[22px] font-medium leading-tight tabular-nums">{qty(data.qty)}</div>
        </div>
        <div>
          <div className="text-[11px] text-muted-foreground">Per bag</div>
          <div className="display-num text-[22px] font-medium leading-tight tabular-nums">
            {data.qty > 0 ? formatMoney(Math.round(data.netSalesCents / data.qty)) : "—"}
          </div>
        </div>
      </div>

      <ul className="mt-4 space-y-2.5">
        {top.map((f) => (
          <li key={f.name}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{f.name}</span>
              <span className="num shrink-0 tabular-nums text-muted-foreground">
                {qty(f.qty)} · <span className="font-semibold text-foreground">{formatMoney(f.netSalesCents)}</span>
              </span>
            </div>
            <div aria-hidden className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-highlight" style={{ width: `${Math.max(3, (f.netSalesCents / max) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
      {data.flavours.length > top.length && (
        <p className="mt-2 text-xs text-muted-foreground">+ {data.flavours.length - top.length} more</p>
      )}
    </section>
  );
}
