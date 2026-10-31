import Link from "next/link";
import { Plus, Download, CheckCircle2, AlertTriangle } from "lucide-react";
import { requireCapability } from "@/lib/scope";
import { getActiveEvent } from "@/modules/events/queries";
import { listCashCloses, listPayouts, getCashPosition } from "@/modules/cash/queries";
import { payoutKindLabel } from "@/modules/cash/payout-kinds";
import { PageHeader } from "@/components/page-header";
import { StatTile, StatTileRow } from "@/components/stat-tile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableOnDesktop, MobileList, MobileRow, MobileField, MobileEmpty } from "@/components/mobile-list";
import { formatMoney } from "@/lib/money";
import { fmtDate } from "@/lib/date";

export const dynamic = "force-dynamic";

/*
  How many payout rows the page renders. The list is a transparency aid, not an
  archive: the total above it is summed in the database, and a day's own payouts
  are on that day's entry. Rendering every row a business ever recorded — twice,
  once per breakpoint — bought nothing.
*/
const PAYOUT_ROWS = 50;

export default async function CashPage() {
  const scope = await requireCapability("cash");
  const activeEvent = await getActiveEvent(scope.businessId);
  /*
    The summary band reads across every event, all the way back; the table
    under it stays on the recent window and the chosen event.

    All four tiles share that one basis deliberately. Cash in hand is a
    balance that accumulates over every market this business has traded, and
    putting it beside three thirty-day flows made the row read as one set of
    figures when it was two — the kind of quiet mismatch that gets money
    counted wrong. A thirty-day window is arbitrary here anyway: this business
    trades at events with weeks of nothing in between, so a month can contain
    no trading at all.
  */
  const [closes, payouts, position] = await Promise.all([
    listCashCloses(scope.locationId, 30, activeEvent?.id ?? null),
    listPayouts(scope.locationId, PAYOUT_ROWS),
    getCashPosition(scope.locationId),
  ]);

  const totalPaidOut = position.paidOutCents;

  return (
    <div>
      <PageHeader
        eyebrow="Cash · Closes"
        title="Cash close"
        description={`${position.closes} close${position.closes === 1 ? "" : "s"} recorded · ${closes.length} in the last 30 days`}
        actions={
          <>
            <Button asChild variant="outline" size="sm"><a href="/api/exports/cash"><Download className="h-3.5 w-3.5" /> CSV</a></Button>
            <Button asChild size="sm"><Link href="/cash/new"><Plus className="h-3.5 w-3.5" /> New close</Link></Button>
          </>
        }
      />
      <div className="mx-auto max-w-[1400px] space-y-5 px-4 pb-10 pt-5 sm:px-6 lg:px-8">
        <StatTileRow>
          {/* No metas on these four. Four-across leaves roughly 240px a tile,
              and a five-figure total beside even a two-word meta truncates the
              figure — which is the one thing on the tile that has to be exact.
              The supporting detail goes in the line underneath instead. */}
          <StatTile label="Cash in hand" value={formatMoney(position.inHandCents)} />
          <StatTile label="Paid out" value={formatMoney(position.paidOutCents)} />
          <StatTile label="Banked" value={formatMoney(position.bankedCents)} />
          <StatTile label="Net over / short" value={formatMoney(position.overShortCents, { signed: true })} />
        </StatTileRow>

        {position.countedTills > 0 ? (
          <p className="text-xs text-muted-foreground">
            Cash in hand adds up every counted till across{" "}
            <span className="text-foreground">
              {position.countedTills} event{position.countedTills === 1 ? "" : "s"}
            </span>
            {position.firstCountedDate && (
              <> since <span className="text-foreground">{fmtDate(position.firstCountedDate)}</span></>
            )}
            , each one less the float put in to make change. Banked cash and payouts are already
            out of it — both left the till before it was counted, so taking them off again would
            deduct the same money twice.
            {position.floatCents > 0 && (
              <>
                {" "}
                The <span className="text-foreground">{formatMoney(position.floatCents)}</span>{" "}
                float is on top of this, as working change rather than takings.
              </>
            )}
            {position.safeCents > 0 && (
              <>
                {" "}
                A further <span className="text-foreground">{formatMoney(position.safeCents)}</span>{" "}
                was counted in the safe at the last close.
              </>
            )}{" "}
            Paid out, banked and over/short cover every event too.
          </p>
        ) : position.closes > 0 ? (
          <p className="text-xs text-muted-foreground">
            None of the <span className="text-foreground">{position.closes}</span> closes recorded
            has a till count, so there is nothing to add up yet. Open a day and enter what was in
            the till at the end of it.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            No closes recorded yet, so there is nothing to count from.
          </p>
        )}

        {/* Its own line rather than the tail of the explanation: it says the
            headline figure is missing events, which is the one thing here
            somebody has to act on. */}
        {position.uncounted > 0 && position.countedTills > 0 && (
          <p className="flex items-start gap-2 text-xs text-warning">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              <span className="font-medium">
                {position.uncounted} close{position.uncounted === 1 ? "" : "s"} left out
              </span>{" "}
              — {position.uncounted === 1 ? "it has" : "they have"} no till count, and a counted
              till always holds at least the float, so a zero there means nobody counted it. Open{" "}
              {position.uncounted === 1 ? "that day" : "those days"} and enter what was in the till
              to bring {position.uncounted === 1 ? "it" : "them"} into the total.
            </span>
          </p>
        )}

        {/* The bento shell rides on the desktop-only wrapper so the card itself disappears with the table on phones. */}
        <TableOnDesktop className="bento">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Event</TableHead>
                <TableHead className="text-right">Cash</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Deposit</TableHead>
                <TableHead className="text-right">Paid out</TableHead>
                <TableHead className="text-right">Expected</TableHead>
                <TableHead className="text-right">Over/Short</TableHead>
                <TableHead>Verified</TableHead>
                <TableHead className="text-right">Flag</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {closes.map((c) => {
                const flagged = Math.abs(c.overShortCents) > 2000;
                const dateStr = c.businessDate.toISOString().slice(0, 10);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <Link href={`/cash/new?date=${dateStr}`} className="hover:underline">{fmtDate(c.businessDate)}</Link>
                      <div className="text-2xs text-muted-foreground">{c.closedBy.name}</div>
                    </TableCell>
                    <TableCell>
                      {c.event ? (
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.event.color ?? "hsl(var(--muted-foreground))" }} />
                          {c.event.name}
                        </span>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-right num">{formatMoney(c.cashCents)}</TableCell>
                    <TableCell className="text-right num">{formatMoney(c.creditCents)}</TableCell>
                    <TableCell className="text-right num">{formatMoney(c.depositCents)}</TableCell>
                    <TableCell className={`text-right num ${c.paidOutCents > 0 ? "" : "text-muted-foreground"}`}>
                      {c.paidOutCents > 0 ? formatMoney(c.paidOutCents) : "—"}
                    </TableCell>
                    <TableCell className="text-right num">{formatMoney(c.expectedCents)}</TableCell>
                    <TableCell className={`text-right num ${c.overShortCents < 0 ? "text-destructive" : c.overShortCents > 0 ? "text-warning" : "text-success"}`}>{formatMoney(c.overShortCents, { signed: true })}</TableCell>
                    <TableCell>
                      {c.verifiedBy ? (
                        <span className="inline-flex items-center gap-1 text-success text-xs">
                          <CheckCircle2 className="h-3 w-3" /> {c.verifiedBy.name}
                        </span>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-right">{flagged ? <Badge variant="danger">Over $20</Badge> : <Badge variant="muted">OK</Badge>}</TableCell>
                  </TableRow>
                );
              })}
              {closes.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">No closes recorded yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableOnDesktop>

        <MobileList>
          {closes.map((c) => {
            const flagged = Math.abs(c.overShortCents) > 2000;
            const dateStr = c.businessDate.toISOString().slice(0, 10);
            return (
              <MobileRow
                key={c.id}
                href={`/cash/new?date=${dateStr}`}
                title={fmtDate(c.businessDate)}
                subtitle={c.closedBy.name}
                meta={
                  <span className={c.overShortCents < 0 ? "text-destructive" : c.overShortCents > 0 ? "text-warning" : "text-success"}>
                    {formatMoney(c.overShortCents, { signed: true })}
                  </span>
                }
                badges={
                  <>
                    {flagged ? <Badge variant="danger">Over $20</Badge> : <Badge variant="muted">OK</Badge>}
                    {c.verifiedBy ? (
                      <Badge variant="success"><CheckCircle2 className="h-3 w-3" /> {c.verifiedBy.name}</Badge>
                    ) : (
                      <Badge variant="outline">Unverified</Badge>
                    )}
                  </>
                }
              >
                <MobileField label="Cash" value={formatMoney(c.cashCents)} />
                <MobileField label="Credit" value={formatMoney(c.creditCents)} />
                <MobileField label="Deposit" value={formatMoney(c.depositCents)} />
                {c.paidOutCents > 0 && <MobileField label="Paid out" value={formatMoney(c.paidOutCents)} />}
                <MobileField label="Expected" value={formatMoney(c.expectedCents)} />
                <MobileField
                  label="Event"
                  className="col-span-2"
                  value={
                    c.event ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: c.event.color ?? "hsl(var(--muted-foreground))" }} />
                        {c.event.name}
                      </span>
                    ) : "—"
                  }
                />
              </MobileRow>
            );
          })}
          {closes.length === 0 && <MobileEmpty>No closes recorded yet.</MobileEmpty>}
        </MobileList>

        {/* Every payout in the window, in the open — the point of recording
            them is that anyone can see what left the drawer without having to
            open each day's entry one at a time. */}
        <div className="bento">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3 sm:px-5">
            <h2 className="text-sm font-semibold">
              Payouts
              <span className="ml-2 text-2xs font-normal text-muted-foreground">
                {/* The true count comes from the aggregate, not from the array —
                    the list is capped, the figure beside it is not. */}
                {position.payoutCount} across every event
                {position.payoutCount > payouts.length && ` · showing the latest ${payouts.length}`}
              </span>
            </h2>
            <span className="num text-sm font-semibold">{formatMoney(totalPaidOut)}</span>
          </div>

          {/*
            Split by what the money was for.

            Every payout has recorded its kind for a while and nothing ever
            added them up, so paying someone back for cups they bought on
            their own card sat in the same undifferentiated total as cash
            handed straight to a supplier. Both leave the till and both belong
            in the day's reconciliation — but one is a debt to a person being
            settled and the other is a purchase, and only one of them is a
            supplier relationship anybody would want to look at.

            Under the header rather than on the tile above: that row is four
            across, and a figure that has to share its width with three
            labelled amounts truncates the one thing on it that has to be
            exact.
          */}
          {position.paidOutByKind.length > 1 && (
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 border-b border-border px-4 py-2.5 text-2xs text-muted-foreground sm:px-5">
              {position.paidOutByKind.map((k) => (
                <span key={k.kind}>
                  {payoutKindLabel(k.kind)}{" "}
                  <span className="num text-foreground">{formatMoney(k.amountCents)}</span>{" "}
                  <span className="text-muted-foreground">
                    ({k.count} payout{k.count === 1 ? "" : "s"})
                  </span>
                </span>
              ))}
            </div>
          )}

          {payouts.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground sm:px-5">
              Nothing has ever been taken out of the drawer. Record one from a day&rsquo;s
              entry under <span className="text-foreground">Payouts</span> — for example paying someone
              back who bought supplies on their own card.
            </p>
          ) : (
            <>
              <TableOnDesktop>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>What for</TableHead>
                      <TableHead>Paid to</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Receipt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payouts.map((p) => {
                      const dateStr = p.businessDate.toISOString().slice(0, 10);
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">
                            <Link href={`/cash/new?date=${dateStr}`} className="hover:underline">
                              {fmtDate(p.businessDate)}
                            </Link>
                          </TableCell>
                          <TableCell className="num text-right font-medium">{formatMoney(p.amountCents)}</TableCell>
                          <TableCell>{p.reason}</TableCell>
                          <TableCell>{p.paidTo ?? "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{payoutKindLabel(p.kind)}</TableCell>
                          <TableCell className="font-mono text-xs">{p.reference ?? "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableOnDesktop>

              <MobileList>
                {payouts.map((p) => (
                  <MobileRow
                    key={p.id}
                    href={`/cash/new?date=${p.businessDate.toISOString().slice(0, 10)}`}
                    title={p.reason}
                    subtitle={fmtDate(p.businessDate)}
                    meta={<span className="num">{formatMoney(p.amountCents)}</span>}
                    badges={<Badge variant="muted">{payoutKindLabel(p.kind)}</Badge>}
                  >
                    <MobileField label="Paid to" value={p.paidTo ?? "—"} />
                    <MobileField label="Receipt" value={p.reference ?? "—"} />
                  </MobileRow>
                ))}
              </MobileList>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
