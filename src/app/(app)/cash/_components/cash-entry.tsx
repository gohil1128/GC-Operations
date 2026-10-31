"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  saveCashCloseAction, addDepositAction, deleteDepositAction, verifyCloseAction,
  addPayoutAction, updatePayoutAction, deletePayoutAction, deleteCashCloseAction,
} from "@/modules/cash/actions";
import { DeleteButton } from "@/components/delete-button";
import { toast } from "@/components/ui/use-toast";
import { PAYOUT_KINDS, payoutKindLabel } from "@/modules/cash/payout-kinds";
import type { PayoutKind } from "@prisma/client";

type Existing = {
  id: string;
  openingDollars: number; closingDollars: number; cashDollars: number; creditDollars: number;
  safeCountDollars: number; paidInDollars: number; paidOutDollars: number;
  expectedDollars: number; overShortDollars: number;
  weather: string; specialEvents: string; eventId: string | null;
  notes: string;
  closedByName: string; verifiedByName: string | null; verifiedAt: string | null;
  createdAt: string;
};
type Deposit = {
  id: string; sequence: number | null; amountDollars: number;
  bagCode: string | null; preparedBy: string | null; notes: string | null;
};
type Payout = {
  id: string; amountDollars: number; kind: PayoutKind;
  reason: string; paidTo: string | null; reference: string | null;
};
type Event = { id: string; name: string; color: string | null };

const fmt = (n: number) => `$${n.toFixed(2)}`;

export function CashEntry({
  businessDate, locationName, netSalesDollars, events, activeEventId, existing, deposits, payouts,
  canVerify,
}: {
  businessDate: string; locationName: string; netSalesDollars: number;
  events: Event[]; activeEventId: string | null;
  existing: Existing | null; deposits: Deposit[]; payouts: Payout[];
  // Signing off somebody else's count, and — because it is the same check —
  // removing a close that has already been signed off.
  canVerify: boolean;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  /*
    Which payout is being corrected, held here rather than on the row.

    The correction form has to live outside the table: the payouts table
    scrolls sideways on a phone, and a form inside one of its cells inherits
    that — half the fields end up off the edge. Above the table it is the same
    shape as the add form, which already lays out at 390px.
  */
  const [editingPayoutId, setEditingPayoutId] = React.useState<string | null>(null);
  // Derived, not stored: if the row is deleted or refreshed away underneath
  // us, the form closes instead of editing something that is gone.
  const editingPayout = payouts.find((p) => p.id === editingPayoutId) ?? null;

  const [opening, setOpening] = React.useState(String(existing?.openingDollars ?? 300));
  const [closing, setClosing] = React.useState(String(existing?.closingDollars ?? 0));
  const [cash, setCash] = React.useState(String(existing?.cashDollars ?? 0));
  const [credit, setCredit] = React.useState(String(existing?.creditDollars ?? 0));
  const [safe, setSafe] = React.useState(String(existing?.safeCountDollars ?? 0));
  const [paidIn, setPaidIn] = React.useState(String(existing?.paidInDollars ?? 0));
  const [weather, setWeather] = React.useState(existing?.weather ?? "");
  const [specialEvents, setSpecialEvents] = React.useState(existing?.specialEvents ?? "");
  const [eventId, setEventId] = React.useState(existing?.eventId ?? activeEventId ?? "");
  const [notes, setNotes] = React.useState(existing?.notes ?? "");

  const expectedSuggestion = netSalesDollars; // exclusive of tax for simplicity
  const [expected, setExpected] = React.useState(
    existing ? String(existing.expectedDollars) : expectedSuggestion.toFixed(2)
  );

  const depositTotal = deposits.reduce((a, d) => a + d.amountDollars, 0);
  // Derived, never typed — the payout list is the record of what left the till.
  const payoutTotal = payouts.reduce((a, p) => a + p.amountDollars, 0);

  const totalCashCredit = (Number(cash) || 0) + (Number(credit) || 0);
  // Mirrors overShortCentsFor() on the server. Cash that left the drawer with
  // a receipt is accounted for, not missing.
  const overShort =
    totalCashCredit + depositTotal + payoutTotal - (Number(paidIn) || 0)
    - (Number(opening) || 0) - (Number(expected) || 0);
  const overShortCents = Math.round(overShort * 100);
  const flag = Math.abs(overShortCents) > 2000;

  const saveClose = () => {
    start(async () => {
      try {
        await saveCashCloseAction({
          businessDate,
          openingDollars: Number(opening),
          closingDollars: Number(closing) || totalCashCredit,
          cashDollars: Number(cash),
          creditDollars: Number(credit),
          safeCountDollars: Number(safe),
          depositDollars: depositTotal,
          paidInDollars: Number(paidIn),
          expectedDollars: Number(expected),
          weather, specialEvents,
          eventId: eventId || null,
          notes,
          checklist: [],
        });
      } catch (err: any) {
        if (err?.digest?.startsWith("NEXT_REDIRECT")) return;
        toast({ title: "Save failed", description: String(err?.message ?? err), variant: "destructive" });
      }
    });
  };

  const verify = () => {
    if (!existing) return;
    start(async () => {
      try {
        await verifyCloseAction(existing.id);
        toast({ title: existing.verifiedByName ? "Verification removed" : "Verified" });
        router.refresh();
      } catch (err: any) {
        toast({ title: "Failed", description: String(err?.message ?? err), variant: "destructive" });
      }
    });
  };

  return (
    <>
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="deposit">Cash Deposit{deposits.length > 0 ? ` (${deposits.length})` : ""}</TabsTrigger>
          <TabsTrigger value="payout">Payouts{payouts.length > 0 ? ` (${payouts.length})` : ""}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>General information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* The verify buttons only appear for someone who may verify.
                    They were rendered for everyone, so a staff member got a
                    button that could only ever fail. */}
                {existing?.verifiedByName ? (
                  <div className="rounded border border-success/30 bg-success/10 text-success px-3 py-2 text-xs flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Verified by {existing.verifiedByName} on {existing.verifiedAt && new Date(existing.verifiedAt).toLocaleString()}
                    {canVerify && (
                      <Button type="button" variant="ghost" size="sm" onClick={verify} disabled={pending} className="ml-auto h-6 text-2xs">Unverify</Button>
                    )}
                  </div>
                ) : existing ? (
                  <div className="rounded border bg-muted/40 text-muted-foreground px-3 py-2 text-xs flex items-center gap-2">
                    Not yet verified.
                    {canVerify && (
                      <Button type="button" size="sm" variant="success" onClick={verify} disabled={pending} className="ml-auto h-6 text-2xs">
                        <CheckCircle2 className="h-3 w-3" /> Verify entry
                      </Button>
                    )}
                  </div>
                ) : null}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="weather">Weather</Label>
                    <Input id="weather" placeholder="Sunny, Rainy, Snowy..." value={weather} onChange={(e) => setWeather(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="event">Event tag</Label>
                    <Select value={eventId || "none"} onValueChange={(v) => setEventId(v === "none" ? "" : v)}>
                      <SelectTrigger id="event"><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {events.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            <span className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: e.color ?? "hsl(var(--muted-foreground))" }} />
                              {e.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="se">Special events / menu specials</Label>
                  <Textarea id="se" rows={2} value={specialEvents} onChange={(e) => setSpecialEvents(e.target.value)} placeholder="e.g. Strawberry Turnover, Spicy Teen burger, $6 Buddy bundle" />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Field id="opening" label="Opening float" value={opening} setter={setOpening} hint="Change you started with" />
                  <Field id="cash" label="Cash in till" value={cash} setter={setCash} hint="Counted at close, float included" />
                  <Field id="credit" label="Card takings" value={credit} setter={setCredit} />
                  <Field id="safe" label="Safe count" value={safe} setter={setSafe} />
                  <Field id="paidIn" label="Paid into till" value={paidIn} setter={setPaidIn} />
                  {/* Read-only on purpose: it adds up the Payouts tab, so
                      there is no total here to disagree with the list. */}
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Paid out of till</Label>
                    <div
                      data-testid="paid-out-total"
                      className="num flex h-8 items-center justify-end rounded-md border border-input bg-muted/40 px-3 text-sm"
                    >
                      {fmt(payoutTotal)}
                    </div>
                    <span className="text-2xs text-muted-foreground">
                      {payouts.length === 0 ? "From the Payouts tab" : `${payouts.length} payout${payouts.length === 1 ? "" : "s"}`}
                    </span>
                  </div>
                  <Field id="expected" label="Expected takings" value={expected} setter={setExpected} hint={expectedSuggestion > 0 ? `Sales recorded: ${fmt(expectedSuggestion)}` : "The day's net sales"} />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>

                {existing && (
                  <div className="text-2xs text-muted-foreground border-t pt-2">
                    Created by {existing.closedByName} on {new Date(existing.createdAt).toLocaleString()}
                  </div>
                )}
              </CardContent>
            </Card>

            <BalancingOverview
              cash={Number(cash) || 0}
              credit={Number(credit) || 0}
              deposits={depositTotal}
              payouts={payoutTotal}
              paidIn={Number(paidIn) || 0}
              opening={Number(opening) || 0}
              expected={Number(expected) || 0}
              overShort={overShort}
              flag={flag}
              expectedSuggestion={expectedSuggestion}
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {/* Only once there is something to delete, and kept away from the
                primary action so the two are not next to each other. */}
            {existing && (
              <DeleteCloseButton
                closeId={existing.id}
                businessDate={businessDate}
                depositCount={deposits.length}
                payoutCount={payouts.length}
                verified={Boolean(existing.verifiedByName)}
                canVerify={canVerify}
              />
            )}
            <Button onClick={saveClose} disabled={pending}>
              {pending ? "Saving..." : (existing ? "Update entry" : "Create entry")}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="deposit" className="space-y-4 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Cash deposits ({deposits.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <AddDeposit businessDate={businessDate} />
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead className="text-right">Cash</TableHead>
                        <TableHead>Bag Code</TableHead>
                        <TableHead>Prepared By</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deposits.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="num text-muted-foreground">{d.sequence ?? "—"}</TableCell>
                          <TableCell className="text-right num font-medium">{fmt(d.amountDollars)}</TableCell>
                          <TableCell className="font-mono text-xs">{d.bagCode ?? "—"}</TableCell>
                          <TableCell>{d.preparedBy ?? "—"}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">{d.notes ?? "—"}</TableCell>
                          <TableCell>
                            <DeleteDepositButton id={d.id} />
                          </TableCell>
                        </TableRow>
                      ))}
                      {deposits.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-6">
                            No deposits recorded yet for {businessDate}.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <BalancingOverview
              cash={Number(cash) || 0}
              credit={Number(credit) || 0}
              deposits={depositTotal}
              payouts={payoutTotal}
              paidIn={Number(paidIn) || 0}
              opening={Number(opening) || 0}
              expected={Number(expected) || 0}
              overShort={overShort}
              flag={flag}
              expectedSuggestion={expectedSuggestion}
            />
          </div>
        </TabsContent>

        <TabsContent value="payout" className="space-y-4 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Payouts ({payouts.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Cash taken out of the drawer during the day — most often paying someone back
                  who bought something on their own card. Recording it here keeps the till
                  balanced: a payout is money accounted for, not money missing.
                </p>
                {editingPayout ? (
                  <EditPayout
                    key={editingPayout.id}
                    payout={editingPayout}
                    onDone={() => setEditingPayoutId(null)}
                  />
                ) : (
                  <AddPayout businessDate={businessDate} />
                )}
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right w-24">Amount</TableHead>
                        <TableHead>What for</TableHead>
                        <TableHead>Paid to</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Receipt</TableHead>
                        <TableHead className="w-20" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payouts.map((p) => (
                        <PayoutRow
                          key={p.id}
                          payout={p}
                          editing={p.id === editingPayoutId}
                          onEdit={() => setEditingPayoutId(p.id)}
                        />
                      ))}
                      {payouts.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-6">
                            No payouts recorded yet for {businessDate}.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <BalancingOverview
              cash={Number(cash) || 0}
              credit={Number(credit) || 0}
              deposits={depositTotal}
              payouts={payoutTotal}
              paidIn={Number(paidIn) || 0}
              opening={Number(opening) || 0}
              expected={Number(expected) || 0}
              overShort={overShort}
              flag={flag}
              expectedSuggestion={expectedSuggestion}
            />
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

/*
  Deleting the whole entry for a day.

  The close was only ever upsertable, so one entered against the wrong day
  could be corrected but not removed, and its over/short stayed in every total
  on /cash.

  Deleting it leaves that day's deposits and payouts alone — they are records
  of money that actually moved, keyed by the day rather than by the close, and
  someone else may have entered them. The confirmation names how many there
  are and says they stay, so nothing about it is discovered afterwards.
*/
function DeleteCloseButton({
  closeId, businessDate, depositCount, payoutCount, verified, canVerify,
}: {
  closeId: string; businessDate: string;
  depositCount: number; payoutCount: number;
  verified: boolean; canVerify: boolean;
}) {
  const router = useRouter();

  // A verified close takes the verify capability to remove. Saying so beats
  // offering a button that can only fail.
  if (verified && !canVerify) {
    return (
      <span className="mr-auto text-2xs text-muted-foreground">
        Verified entries can only be deleted by a manager or the owner.
      </span>
    );
  }

  const attached = [
    depositCount > 0 ? `${depositCount} deposit${depositCount === 1 ? "" : "s"}` : null,
    payoutCount > 0 ? `${payoutCount} payout${payoutCount === 1 ? "" : "s"}` : null,
  ].filter(Boolean).join(" and ");
  // Agreement follows the total, not either count: "1 deposit … stays", but
  // "1 deposit and 1 payout … stay".
  const attachedCount = depositCount + payoutCount;
  const one = attachedCount === 1;

  const confirmText =
    `This removes the cash close for ${businessDate} — the counts, the over/short and the notes. It can't be undone.` +
    (attached
      // Worth saying before rather than after: deleting the close sends you
      // back to the list, so the tabs holding these are no longer in front of
      // you once it is gone.
      ? ` The ${attached} recorded on this day ${one ? "stays" : "stay"}.` +
        ` If ${one ? "that was" : "those were"} a mistake too, cancel and delete` +
        ` ${one ? "it" : "them"} from the tabs above first.`
      : "") +
    (verified ? " This entry has been verified." : "");

  return (
    <div className="mr-auto">
      <DeleteButton
        action={async () => {
          const res = await deleteCashCloseAction(closeId);
          // The action returns its error rather than throwing, because
          // production redacts thrown Server Action messages. Throwing it
          // here, on the client, is what puts it in front of the user.
          if ("error" in res) throw new Error(res.error);
          router.push("/cash");
        }}
        itemLabel="cash close"
        itemName={businessDate}
        confirmText={confirmText}
        successMessage="Cash close deleted"
        size="sm"
        variant="outline"
        refreshAfter={false}
      >
        <Trash2 className="h-3.5 w-3.5" /> Delete entry
      </DeleteButton>
    </div>
  );
}

function Field({ id, label, value, setter, hint }: { id: string; label: string; value: string; setter: (v: string) => void; hint?: string }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input id={id} type="number" step="0.01" min="0" value={value} onChange={(e) => setter(e.target.value)} className="num text-right h-8" />
      {hint && <span className="text-2xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

/*
  The arithmetic, written out.

  This used to be a list of seven figures with no operators between them, and
  the two that are taken off — the opening float and the expected takings —
  looked exactly like the five that are added. Somebody reading it could not
  tell which way any line pushed the answer, so when the over/short came out
  wrong there was no way to see which number was to blame. It was: an
  expected-takings box left at zero makes the entire drawer read as a surplus,
  and nothing on the card said so.

  So every line now carries its sign, and the total is the sum of the column
  as printed. Whatever the figure turns out to be, the reason for it is on
  the card.
*/
function BalancingOverview({ cash, credit, deposits, payouts, paidIn, opening, expected, overShort, flag, expectedSuggestion }: { cash: number; credit: number; deposits: number; payouts: number; paidIn: number; opening: number; expected: number; overShort: number; flag: boolean; expectedSuggestion: number }) {
  /*
    Nothing typed in the Expected box. Worth saying out loud rather than
    leaving as a zero among the other zeros: it is the one blank that turns
    the whole count into a false surplus, and it is blank far more often
    than it is genuinely nil.
  */
  const expectedMissing = expected === 0 && (cash > 0 || credit > 0);
  return (
    <Card>
      <CardHeader><CardTitle>Balancing overview</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm" data-testid="balancing">
        <div className="space-y-1.5">
          <Row label="Cash counted in the till" value={fmt(cash)} />
          <Row op="+" label="Card takings" value={fmt(credit)} />
          <Row op="+" label="Banked during the day" value={fmt(deposits)} testId="deposits" />
          <Row op="+" label="Paid out of the till" value={fmt(payouts)} testId="paid-out" />
          <Row op="−" label="Paid into the till" value={fmt(paidIn)} />
          <Row op="−" label="Opening float" value={fmt(opening)} />
          <Row op="−" label="Expected takings" value={fmt(expected)} />
        </div>
        <div className="border-t pt-2 flex items-center justify-between">
          <span className="font-medium">Over / Short</span>
          <span
            data-testid="over-short"
            className={`font-semibold num ${overShort < 0 ? "text-destructive" : overShort > 0 ? "text-warning" : "text-success"}`}
          >
            {overShort >= 0 ? "+" : ""}{fmt(overShort)}
          </span>
        </div>
        <p className="text-2xs leading-relaxed text-muted-foreground">
          Everything the till should be holding, less what the sales say it should have taken.
          Money paid out with a receipt is added back — it left the drawer, so the drawer is
          short by exactly that much and is not actually missing it. The opening float comes
          off because it was change to start with, not takings.
        </p>
        {expectedMissing && (
          <p className="flex items-start gap-2 text-2xs leading-relaxed text-warning">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              Expected takings is {fmt(0)}, so nothing is being subtracted for the sales — the
              whole drawer is showing up as a surplus.
              {expectedSuggestion > 0 ? (
                <> The day&rsquo;s recorded sales come to {fmt(expectedSuggestion)}.</>
              ) : (
                <> Enter the day&rsquo;s net sales in the Expected takings box.</>
              )}
            </span>
          </p>
        )}
        {flag && <Badge variant="danger">Over $20 — review</Badge>}
      </CardContent>
    </Card>
  );
}

function Row({
  op, label, value, testId,
}: { op?: string; label: string; value: string; testId?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      {/* Fixed width so the figures line up under one another and the column
          reads as a sum rather than as seven unrelated numbers. */}
      <span aria-hidden className="w-3 shrink-0 text-muted-foreground">{op ?? ""}</span>
      <span className="text-muted-foreground">
        {/* Spoken, the operator has to reach the label it belongs to — a
            screen reader announcing "minus" on its own row would attach it
            to whatever came before. */}
        {op && <span className="sr-only">{op === "+" ? "plus " : "minus "}</span>}
        {label}
      </span>
      <span className="flex-1 border-b border-dotted border-border/60" aria-hidden />
      <span className="num" data-testid={testId}>{value}</span>
    </div>
  );
}

function AddDeposit({ businessDate }: { businessDate: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [amount, setAmount] = React.useState("");
  const [bagCode, setBagCode] = React.useState("");
  const [preparedBy, setPreparedBy] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!isFinite(n) || n <= 0) {
      toast({ title: "Enter a valid cash amount", variant: "destructive" });
      return;
    }
    start(async () => {
      try {
        await addDepositAction({
          businessDate,
          amountDollars: n,
          bagCode: bagCode || null,
          preparedBy: preparedBy || null,
          notes: notes || null,
          sequence: null,
        });
        toast({ title: "Deposit added" });
        setAmount(""); setBagCode(""); setPreparedBy(""); setNotes("");
        router.refresh();
      } catch (err: any) {
        toast({ title: "Failed", description: String(err?.message ?? err), variant: "destructive" });
      }
    });
  };

  return (
    <form onSubmit={add} className="rounded-md border bg-muted/30 p-3 grid grid-cols-1 md:grid-cols-[auto_auto_1fr_1fr_auto] gap-3 items-end">
      <div className="grid gap-1.5">
        <Label htmlFor="amt" className="text-xs">Cash *</Label>
        <Input id="amt" type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="num text-right w-32 h-8" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="bag" className="text-xs">Bag Code</Label>
        <Input id="bag" value={bagCode} onChange={(e) => setBagCode(e.target.value)} className="w-32 h-8 font-mono" placeholder="F3159311" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="prep" className="text-xs">Prepared By</Label>
        <Input id="prep" value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)} className="h-8" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="dnotes" className="text-xs">Notes</Label>
        <Input id="dnotes" value={notes} onChange={(e) => setNotes(e.target.value)} className="h-8" />
      </div>
      <Button type="submit" size="sm" disabled={pending}><Plus className="h-3.5 w-3.5" /> Add deposit</Button>
    </form>
  );
}

/*
  One set of payout fields, shared by the add form and by a row being
  corrected — so a payout is described the same way whether it is being
  written down for the first time or fixed afterwards.
*/
type PayoutDraft = {
  amount: string; kind: PayoutKind; reason: string; paidTo: string; reference: string;
};

const emptyDraft: PayoutDraft = {
  amount: "", kind: "REIMBURSEMENT", reason: "", paidTo: "", reference: "",
};

function PayoutFields({
  idPrefix, draft, set, pending, submitLabel, submitIcon, onCancel,
}: {
  idPrefix: string;
  draft: PayoutDraft;
  set: (patch: Partial<PayoutDraft>) => void;
  pending: boolean;
  submitLabel: string;
  submitIcon: React.ReactNode;
  onCancel?: () => void;
}) {
  return (
    <>
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-amt`} className="text-xs">Amount *</Label>
        <Input
          id={`${idPrefix}-amt`} type="number" step="0.01" min="0.01"
          value={draft.amount} onChange={(e) => set({ amount: e.target.value })}
          className="num text-right w-32 h-8" required
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-reason`} className="text-xs">What for *</Label>
        <Input
          id={`${idPrefix}-reason`} value={draft.reason}
          onChange={(e) => set({ reason: e.target.value })}
          className="h-8" placeholder="e.g. bag of ice, milk run" required
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-to`} className="text-xs">Paid to</Label>
        <Input
          id={`${idPrefix}-to`} value={draft.paidTo}
          onChange={(e) => set({ paidTo: e.target.value })}
          className="h-8" placeholder="who took the cash"
        />
      </div>
      <div className="grid gap-1.5 min-w-[160px]">
        <Label htmlFor={`${idPrefix}-kind`} className="text-xs">Type</Label>
        <Select value={draft.kind} onValueChange={(v) => set({ kind: v as PayoutKind })}>
          <SelectTrigger id={`${idPrefix}-kind`} className="h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PAYOUT_KINDS.map((k) => (
              <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-ref`} className="text-xs">Receipt</Label>
        <Input
          id={`${idPrefix}-ref`} value={draft.reference}
          onChange={(e) => set({ reference: e.target.value })}
          className="h-8 w-28 font-mono"
        />
      </div>
      <div className="flex items-center gap-2 md:col-start-5">
        <Button type="submit" size="sm" disabled={pending}>
          {submitIcon} {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </>
  );
}

// Shared by both forms so the two cannot disagree about what is required —
// the server checks the same things, this just says so before the round trip.
function invalidDraft(draft: PayoutDraft): string | null {
  const n = Number(draft.amount);
  if (!isFinite(n) || n <= 0) return "Enter a valid amount";
  if (!draft.reason.trim()) return "Say what the money was for";
  return null;
}

function AddPayout({ businessDate }: { businessDate: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [draft, setDraft] = React.useState<PayoutDraft>(emptyDraft);
  const set = (patch: Partial<PayoutDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const problem = invalidDraft(draft);
    if (problem) {
      toast({ title: problem, variant: "destructive" });
      return;
    }
    start(async () => {
      try {
        await addPayoutAction({
          businessDate,
          amountDollars: Number(draft.amount),
          kind: draft.kind,
          reason: draft.reason.trim(),
          paidTo: draft.paidTo || null,
          reference: draft.reference || null,
        });
        toast({ title: "Payout recorded" });
        setDraft(emptyDraft);
        router.refresh();
      } catch (err: any) {
        toast({ title: "Failed", description: String(err?.message ?? err), variant: "destructive" });
      }
    });
  };

  return (
    <form onSubmit={add} className="rounded-md border bg-muted/30 p-3 grid grid-cols-1 gap-3 md:grid-cols-[auto_1fr_1fr_auto_auto] md:items-end">
      <PayoutFields
        idPrefix="po" draft={draft} set={set} pending={pending}
        submitLabel="Add payout" submitIcon={<Plus className="h-3.5 w-3.5" />}
      />
    </form>
  );
}

/*
  Correcting a payout already recorded.

  Sits where the add form sits, so the fields are in the place the person
  already knows, and the row it belongs to is marked in the table below while
  it is open.
*/
function EditPayout({ payout, onDone }: { payout: Payout; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [draft, setDraft] = React.useState<PayoutDraft>(() => draftOf(payout));
  const set = (patch: Partial<PayoutDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const formRef = React.useRef<HTMLFormElement>(null);

  // The form opens above a list that may be long enough to have scrolled it
  // out of view — otherwise pressing Edit looks like it did nothing.
  React.useEffect(() => {
    formRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const problem = invalidDraft(draft);
    if (problem) {
      toast({ title: problem, variant: "destructive" });
      return;
    }
    start(async () => {
      const res = await updatePayoutAction(payout.id, {
        amountDollars: Number(draft.amount),
        kind: draft.kind,
        reason: draft.reason.trim(),
        paidTo: draft.paidTo || null,
        reference: draft.reference || null,
      });
      if ("error" in res) {
        toast({ title: "Could not save", description: res.error, variant: "destructive" });
        return;
      }
      toast({ title: "Payout updated" });
      onDone();
      router.refresh();
    });
  };

  return (
    <form
      ref={formRef}
      onSubmit={save}
      className="grid grid-cols-1 gap-3 rounded-md border border-brand/40 bg-brand/5 p-3 md:grid-cols-[auto_1fr_1fr_auto_auto] md:items-end"
    >
      <p className="text-xs text-muted-foreground md:col-span-5">
        Correcting the {fmt(payout.amountDollars)} payout for &ldquo;{payout.reason}&rdquo;. The
        day&rsquo;s over/short is worked out again from the new amount.
      </p>
      <PayoutFields
        idPrefix="po-edit" draft={draft} set={set} pending={pending}
        submitLabel={pending ? "Saving..." : "Save changes"}
        submitIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
        onCancel={onDone}
      />
    </form>
  );
}

function PayoutRow({
  payout, editing, onEdit,
}: {
  payout: Payout; editing: boolean; onEdit: () => void;
}) {
  return (
    <TableRow className={editing ? "bg-brand/10" : undefined}>
      <TableCell className="text-right num font-medium">{fmt(payout.amountDollars)}</TableCell>
      <TableCell>{payout.reason}</TableCell>
      <TableCell>{payout.paidTo ?? "—"}</TableCell>
      <TableCell className="text-xs text-muted-foreground">{payoutKindLabel(payout.kind)}</TableCell>
      <TableCell className="font-mono text-xs">{payout.reference ?? "—"}</TableCell>
      <TableCell>
        <div className="flex items-center">
          <Button
            size="icon"
            variant="ghost"
            onClick={onEdit}
            aria-label={`Edit payout: ${payout.reason}`}
          >
            <Pencil className={`h-3.5 w-3.5 ${editing ? "text-brand-ink" : "text-muted-foreground"}`} />
          </Button>
          <DeletePayoutButton id={payout.id} />
        </div>
      </TableCell>
    </TableRow>
  );
}

function draftOf(p: Payout): PayoutDraft {
  return {
    amount: p.amountDollars.toFixed(2),
    kind: p.kind,
    reason: p.reason,
    paidTo: p.paidTo ?? "",
    reference: p.reference ?? "",
  };
}

function DeletePayoutButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <Button
      size="icon"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            await deletePayoutAction(id);
            toast({ title: "Payout removed" });
            router.refresh();
          } catch (err: any) {
            toast({ title: "Failed", description: String(err?.message ?? err), variant: "destructive" });
          }
        })
      }
      aria-label="Delete payout"
    >
      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
    </Button>
  );
}

function DeleteDepositButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <Button
      size="icon"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            await deleteDepositAction(id);
            toast({ title: "Deposit removed" });
            router.refresh();
          } catch (err: any) {
            toast({ title: "Failed", description: String(err?.message ?? err), variant: "destructive" });
          }
        })
      }
      aria-label="Delete deposit"
    >
      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
    </Button>
  );
}
