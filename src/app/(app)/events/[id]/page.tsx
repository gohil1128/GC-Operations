import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, ExternalLink } from "lucide-react";
import { requireCapability } from "@/lib/scope";
import { getEventDetail } from "@/modules/events/detail";
import { PageHeader } from "@/components/page-header";
import { EventSection, Money, Num } from "./_components/section";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableOnDesktop, MobileList, MobileRow, MobileField } from "@/components/mobile-list";
import { Badge } from "@/components/ui/badge";
import { fmtDate } from "@/lib/date";
import { formatMoney, formatPercent } from "@/lib/money";
import { EXPENSE_CATEGORIES } from "@/modules/expenses/queries";

export const dynamic = "force-dynamic";

const EXPENSE_LABEL = new Map(EXPENSE_CATEGORIES.map((c) => [c.value, c.label]));

/*
  One event, end to end.

  Everything tagged to the event, in the order an operator asks about it: what
  it made, what it sold, what it cost, who worked it, what came out of the till.
  Where a figure is derived rather than tagged — labor, and the share of a
  shared invoice — the section says so on its face.
*/
export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireCapability("events");
  const detail = await getEventDetail(scope.businessId, scope.locationId, id);
  if (!detail) notFound();

  const { event, column, sales, items, invoices, shared, expenses, cashCloses, assets, labor, totals } =
    detail;
  const q = `?event=${encodeURIComponent(event.id)}`;

  return (
    <div>
      <PageHeader
        eyebrow={
          <>
            <Link href="/events" className="hover:underline">
              Events
            </Link>
          </>
        }
        title={event.name}
        description={`${fmtDate(event.startDate)}${
          event.endDate.getTime() !== event.startDate.getTime() ? ` – ${fmtDate(event.endDate)}` : ""
        }${event.feeCents > 0 ? ` · Booth fee ${formatMoney(event.feeCents)}` : ""}`}
        actions={
          <>
            <Link
              href={`/dashboard?event=${event.id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-[13px] font-medium transition-colors hover:bg-accent"
            >
              On the dashboard
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </Link>
            <a
              href={`/api/exports/event-summary${q}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-espresso px-3.5 py-2 text-[13px] font-medium text-espresso-foreground"
            >
              Export CSV
              <Download className="h-3.5 w-3.5" aria-hidden />
            </a>
          </>
        }
      />

      <div className="mx-auto max-w-[1400px] space-y-5 px-4 pb-12 pt-4 sm:px-6 lg:px-8">
        {/* Headline P&L, straight from the same query the Overview statement
            uses, so the two can never disagree. */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <Tile label="Net sales" value={formatMoney(column?.netSalesCents ?? 0)} />
          <Tile
            label="Profit"
            value={formatMoney(column?.profitCents ?? 0, { signed: true })}
            tone={(column?.profitCents ?? 0) < 0 ? "danger" : (column?.profitCents ?? 0) > 0 ? "success" : undefined}
          />
          <Tile label="Margin" value={formatPercent(column?.marginPct ?? 0)} />
          <Tile label="Transactions" value={(column?.txns ?? 0).toLocaleString()} />
          <Tile label="Items sold" value={totals.itemsQty.toLocaleString()} />
          <Tile label="Tips" value={formatMoney(totals.salesTipsCents)} />
        </div>

        {column && (
          <EventSection title="Profit & loss" count={null} subtitle="The event's column from the P&L statement.">
            <dl className="num divide-y divide-border text-[13px]">
              <PnlLine label="Net sales" value={formatMoney(column.netSalesCents)} strong />
              {/* Cost lines with nothing recorded are dropped rather than
                  printed as a column of em-dashes. Net sales and profit always
                  show, so the card never loses its anchors. */}
              {column.cogsCents > 0 && (
                <PnlLine label="Cost of goods" value={formatMoney(-column.cogsCents)} muted />
              )}
              {/* The line between what the chai cost and what the day cost.
                  Only where there is a cost of goods to subtract — otherwise
                  it would just restate net sales. */}
              {column.cogsCents > 0 && (
                <PnlLine
                  label="Gross profit"
                  value={`${formatMoney(column.grossProfitCents)} (${formatPercent(column.grossMarginPct)})`}
                  strong
                />
              )}
              {column.laborCents > 0 && (
                <PnlLine label="Labor" value={formatMoney(-column.laborCents)} muted />
              )}
              {column.opexCents > 0 && (
                <PnlLine label="Operating expenses" value={formatMoney(-column.opexCents)} muted />
              )}
              {column.feeCents > 0 && (
                <PnlLine label="Event fees" value={formatMoney(-column.feeCents)} muted />
              )}
              {column.cogsCents + column.laborCents + column.opexCents + column.feeCents === 0 && (
                <PnlLine label="No costs recorded against this event" value="" muted />
              )}
              <PnlLine
                label="Profit"
                value={`${formatMoney(column.profitCents, { signed: true })} (${formatPercent(column.marginPct)})`}
                strong
              />
              <PnlLine label="Tips (staff, not in profit)" value={formatMoney(column.tipsCents)} muted />
            </dl>
          </EventSection>
        )}

        {/* ── Sales ─────────────────────────────────────────────────────── */}
        <EventSection
          title="Daily sales"
          count={sales.length}
          subtitle={`${formatMoney(totals.salesNetCents)} net · ${totals.guests.toLocaleString()} transactions`}
          empty="No sales tagged to this event yet."
        >
          <TableOnDesktop>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Net sales</TableHead>
                  <TableHead className="text-right">Tax</TableHead>
                  <TableHead className="text-right">Tips</TableHead>
                  <TableHead className="text-right">Transactions</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{fmtDate(s.businessDate)}</TableCell>
                    <Money>{s.netSalesCents}</Money>
                    <Money muted>{s.taxCents}</Money>
                    <Money muted>{s.tipsCents}</Money>
                    <Num>{s.guestCount}</Num>
                    <TableCell className="text-xs text-muted-foreground">{s.source}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableOnDesktop>
          <MobileList>
            {sales.map((s) => (
              <MobileRow
                key={s.id}
                title={fmtDate(s.businessDate)}
                meta={formatMoney(s.netSalesCents)}
                subtitle={s.source}
              >
                <MobileField label="Tax" value={formatMoney(s.taxCents)} />
                <MobileField label="Tips" value={formatMoney(s.tipsCents)} />
                <MobileField label="Transactions" value={s.guestCount.toLocaleString()} />
              </MobileRow>
            ))}
          </MobileList>
        </EventSection>

        {/* ── Items ─────────────────────────────────────────────────────── */}
        <EventSection
          title="Items sold"
          count={items.length}
          subtitle={`${totals.itemsQty.toLocaleString()} units · ${formatMoney(totals.itemsNetCents)}`}
          empty="No item-level sales for this event. Upload the Square per-item CSV to see them."
        >
          <TableOnDesktop>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Net sales</TableHead>
                  <TableHead className="text-right">Transactions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i) => (
                  <TableRow key={i.itemName}>
                    <TableCell className="font-medium">{i.itemName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{i.category ?? "—"}</TableCell>
                    <Num>{i.qty}</Num>
                    <Money>{i.netSalesCents}</Money>
                    <Num>{i.txCount}</Num>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableOnDesktop>
          <MobileList>
            {items.map((i) => (
              <MobileRow
                key={i.itemName}
                title={i.itemName}
                subtitle={i.category ?? undefined}
                meta={formatMoney(i.netSalesCents)}
              >
                <MobileField label="Units" value={i.qty.toLocaleString()} />
                <MobileField label="Transactions" value={i.txCount.toLocaleString()} />
              </MobileRow>
            ))}
          </MobileList>
        </EventSection>

        {/* ── Invoices ──────────────────────────────────────────────────── */}
        <EventSection
          title="Invoices"
          count={invoices.length}
          subtitle={`${formatMoney(totals.invoicesCents)}${
            totals.invoicesOpen > 0 ? ` · ${totals.invoicesOpen} still open` : " · all closed"
          }`}
          empty="No invoices tagged to this event."
        >
          <TableOnDesktop>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Number</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Lines</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>{fmtDate(inv.invoiceDate)}</TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/purchasing/invoices/${inv.id}`} className="hover:underline">
                        {inv.supplier.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {inv.invoiceNumber ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{inv.category ?? "—"}</TableCell>
                    <Num>{inv._count.items}</Num>
                    <Money>{inv.totalCents}</Money>
                    <TableCell>
                      <Badge variant={inv.closedAt ? "secondary" : "brand"}>
                        {inv.closedAt ? "Closed" : "Open"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableOnDesktop>
          <MobileList>
            {invoices.map((inv) => (
              <MobileRow
                key={inv.id}
                href={`/purchasing/invoices/${inv.id}`}
                title={inv.supplier.name}
                subtitle={`${inv.invoiceNumber ?? "No number"} · ${fmtDate(inv.invoiceDate, "MMM d")}`}
                meta={formatMoney(inv.totalCents)}
                badges={
                  <Badge variant={inv.closedAt ? "secondary" : "brand"}>
                    {inv.closedAt ? "Closed" : "Open"}
                  </Badge>
                }
              >
                <MobileField label="Lines" value={inv._count.items.toLocaleString()} />
                <MobileField label="Category" value={inv.category ?? "—"} />
              </MobileRow>
            ))}
          </MobileList>
        </EventSection>

        {/* Shared costs carry a real caveat, so they get their own section
            rather than being folded in as if they were tagged. */}
        {shared.invoices.length > 0 && (
          <EventSection
            title="Shared invoices"
            count={shared.invoices.length}
            subtitle={`${formatMoney(shared.totalCents)} across ${shared.shareDiv} event${
              shared.shareDiv === 1 ? "" : "s"
            } — ${formatMoney(shared.shareCents)} of it counted against this one`}
            note="Tagged “applies to all events”, so each event carries an equal share rather than the full amount."
          >
            <TableOnDesktop>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Number</TableHead>
                    <TableHead className="text-right">Full total</TableHead>
                    <TableHead className="text-right">This event&rsquo;s share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shared.invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>{fmtDate(inv.invoiceDate)}</TableCell>
                      <TableCell className="font-medium">
                        <Link href={`/purchasing/invoices/${inv.id}`} className="hover:underline">
                          {inv.supplier.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {inv.invoiceNumber ?? "—"}
                      </TableCell>
                      <Money muted>{inv.totalCents}</Money>
                      <Money>{Math.round(inv.totalCents / shared.shareDiv)}</Money>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableOnDesktop>
            <MobileList>
              {shared.invoices.map((inv) => (
                <MobileRow
                  key={inv.id}
                  href={`/purchasing/invoices/${inv.id}`}
                  title={inv.supplier.name}
                  subtitle={`${inv.invoiceNumber ?? "No number"} · ${fmtDate(inv.invoiceDate, "MMM d")}`}
                  meta={formatMoney(Math.round(inv.totalCents / shared.shareDiv))}
                >
                  <MobileField label="Full total" value={formatMoney(inv.totalCents)} />
                  <MobileField label="Split across" value={`${shared.shareDiv} events`} />
                </MobileRow>
              ))}
            </MobileList>
          </EventSection>
        )}

        {/* ── Expenses ──────────────────────────────────────────────────── */}
        <EventSection
          title="Operating expenses"
          count={expenses.length}
          subtitle={formatMoney(totals.expensesCents)}
          empty="No expenses tagged to this event."
        >
          <TableOnDesktop>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{fmtDate(e.businessDate)}</TableCell>
                    <TableCell>{EXPENSE_LABEL.get(e.category) ?? e.category}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {e.vendor?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {e.description ?? "—"}
                    </TableCell>
                    <Money>{e.amountCents}</Money>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableOnDesktop>
          <MobileList>
            {expenses.map((e) => (
              <MobileRow
                key={e.id}
                title={EXPENSE_LABEL.get(e.category) ?? e.category}
                subtitle={`${fmtDate(e.businessDate, "MMM d")}${e.vendor ? ` · ${e.vendor.name}` : ""}`}
                meta={formatMoney(e.amountCents)}
              >
                {e.description && <MobileField label="Note" value={e.description} />}
              </MobileRow>
            ))}
          </MobileList>
        </EventSection>

        {/* ── Labor ─────────────────────────────────────────────────────── */}
        <EventSection
          title="Labor"
          count={labor.length}
          subtitle={formatMoney(totals.laborCents)}
          note="Shifts carry no event tag, so these are the shifts worked inside the event's dates rather than shifts attributed to it."
          empty="No shifts recorded inside this event's dates."
        >
          <TableOnDesktop>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {labor.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{fmtDate(l.start)}</TableCell>
                    <TableCell className="font-medium">{l.employee}</TableCell>
                    <TableCell className="num text-right">{(l.minutes / 60).toFixed(2)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {l.actual ? "Clocked" : "Scheduled"}
                    </TableCell>
                    <Money>{l.costCents}</Money>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableOnDesktop>
          <MobileList>
            {labor.map((l) => (
              <MobileRow
                key={l.id}
                title={l.employee}
                subtitle={`${fmtDate(l.start, "MMM d")} · ${l.actual ? "Clocked" : "Scheduled"}`}
                meta={formatMoney(l.costCents)}
              >
                <MobileField label="Hours" value={(l.minutes / 60).toFixed(2)} />
              </MobileRow>
            ))}
          </MobileList>
        </EventSection>

        {/* ── Cash ──────────────────────────────────────────────────────── */}
        <EventSection
          title="Cash closes"
          count={cashCloses.length}
          subtitle={`Over/short ${formatMoney(totals.cashOverShortCents, { signed: true })}`}
          empty="No cash closes tagged to this event."
        >
          <TableOnDesktop>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Cash</TableHead>
                  <TableHead className="text-right">Card</TableHead>
                  <TableHead className="text-right">Deposit</TableHead>
                  <TableHead className="text-right">Over / short</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cashCloses.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{fmtDate(c.businessDate)}</TableCell>
                    <Money muted>{c.cashCents}</Money>
                    <Money muted>{c.creditCents}</Money>
                    <Money muted>{c.depositCents}</Money>
                    <TableCell
                      className={`num text-right font-semibold ${
                        c.overShortCents < 0
                          ? "text-destructive"
                          : c.overShortCents > 0
                            ? "text-success"
                            : ""
                      }`}
                    >
                      {formatMoney(c.overShortCents, { signed: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableOnDesktop>
          <MobileList>
            {cashCloses.map((c) => (
              <MobileRow
                key={c.id}
                title={fmtDate(c.businessDate)}
                meta={formatMoney(c.overShortCents, { signed: true })}
                subtitle="Over / short"
              >
                <MobileField label="Cash" value={formatMoney(c.cashCents)} />
                <MobileField label="Card" value={formatMoney(c.creditCents)} />
                <MobileField label="Deposit" value={formatMoney(c.depositCents)} />
              </MobileRow>
            ))}
          </MobileList>
        </EventSection>

        {/* ── Capital ───────────────────────────────────────────────────── */}
        {assets.length > 0 && (
          <EventSection
            title="Equipment bought for this event"
            count={assets.length}
            subtitle={formatMoney(totals.assetsCents)}
            note="Capital spend is not an operating cost, so it does not appear in the P&L above."
          >
            <TableOnDesktop>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Purchased</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{fmtDate(a.purchaseDate)}</TableCell>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{a.vendor ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{a.status}</TableCell>
                      <Money>{a.purchasePriceCents}</Money>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableOnDesktop>
            <MobileList>
              {assets.map((a) => (
                <MobileRow
                  key={a.id}
                  title={a.name}
                  subtitle={`${fmtDate(a.purchaseDate, "MMM d")}${a.vendor ? ` · ${a.vendor}` : ""}`}
                  meta={formatMoney(a.purchasePriceCents)}
                >
                  <MobileField label="Status" value={a.status} />
                </MobileRow>
              ))}
            </MobileList>
          </EventSection>
        )}

        {event.notes && (
          <EventSection title="Notes" count={null}>
            <p className="whitespace-pre-wrap text-sm text-secondary-foreground">{event.notes}</p>
          </EventSection>
        )}
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger";
}) {
  const toneCls = tone === "danger" ? "text-destructive" : tone === "success" ? "text-success" : "";
  return (
    <div className="bento min-w-0 p-3.5">
      <div className="text-2xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`display-num mt-1.5 truncate text-[22px] font-medium ${toneCls}`}>{value}</div>
    </div>
  );
}

function PnlLine({
  label,
  value,
  muted,
  strong,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className={muted ? "pl-3 text-muted-foreground" : strong ? "font-semibold" : ""}>{label}</dt>
      <dd className={strong ? "font-semibold" : ""}>{value}</dd>
    </div>
  );
}
