import { ShieldCheck, Store } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { businessDayFromIso, fmtBusinessDate, fmtDate, todayIsoIn } from "@/lib/date";
import { missingSquareConfig } from "@/modules/square/service";
import type { SyncResult } from "@/modules/square/sync";
import { SquareDisconnect, SquareHistory, SquareSyncNow, UseSquareForDays } from "./square-sync-client";

/*
  Square sales, live.

  Replaces uploading a Sales Summary and an Item Sales CSV for every market
  day: once connected, completed sales arrive on their own every three hours,
  as daily totals, per-item rows, tips and the card side of the cash close.
  The CSV importers stay underneath for anything the sync cannot reach.
*/

const FLASH: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: "Square is connected and the last 30 days are syncing. Press Sync now to see them straight away." },
  denied: { ok: false, text: "Square was told no, so nothing was connected." },
  "bad-state": { ok: false, text: "That sign-in link expired or wasn't yours. Start again from here." },
  "no-locations": { ok: false, text: "That Square account has no active locations to read sales from." },
  failed: { ok: false, text: "Connecting didn't work. Try again; if it repeats, check the Square settings in docs/SQUARE-SYNC.md." },
  "not-configured": { ok: false, text: "The keys this needs aren't set up yet — see below." },
};

const since = (d: Date | null) => {
  if (!d) return "never";
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 2) return "just now";
  if (mins < 90) return `${mins} min ago`;
  if (mins < 60 * 36) return `${Math.round(mins / 60)} h ago`;
  return fmtDate(d, "MMM d");
};

export async function SquareSyncCard({ businessId, flash }: { businessId: string; flash?: string }) {
  const conn = await prisma.squareConnection.findUnique({ where: { businessId } });
  const missing = missingSquareConfig();
  const note = flash ? FLASH[flash] : undefined;
  const last = (conn?.lastResult ?? null) as (SyncResult & { at?: string }) | null;

  // The hand-entered days the last sync left alone, if they still are.
  const kept = conn && last?.manualDaysKept?.length
    ? (await prisma.dailySales.findMany({
        where: { locationId: conn.locationId, source: "MANUAL", businessDate: { in: last.manualDaysKept.map(businessDayFromIso) } },
        select: { businessDate: true },
        orderBy: { businessDate: "asc" },
      })).map((d) => d.businessDate.toISOString().slice(0, 10))
    : [];
  const locations = (conn?.squareLocations ?? []) as { id: string; name: string }[];
  const today = conn ? todayIsoIn(conn.timezone) : null;

  return (
    <Card id="square" data-settings-section className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Store className="h-4 w-4" aria-hidden /> Square sales
          {conn ? (
            <Badge variant={conn.status === "ACTIVE" ? "success" : "danger"}>
              {conn.status === "ACTIVE" ? "Connected" : "Needs reconnecting"}
            </Badge>
          ) : (
            <Badge variant="outline">Not connected</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Brings in every completed Square sale every three hours — daily totals, what sold, tips, and
          card takings for the cash close — so there is no CSV to upload after a market. Read-only: it
          cannot take, refund or change anything in Square.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {note && (
          <p role="status" className={`rounded-2xl px-4 py-3 text-sm ${note.ok ? "bg-success-muted text-success" : "bg-destructive-muted text-destructive"}`}>
            {note.text}
          </p>
        )}

        {missing.length > 0 && (
          <div className="rounded-2xl border border-warning-border bg-warning-muted px-4 py-3 text-sm text-warning-ink">
            <p className="font-semibold">Not set up yet</p>
            <p className="mt-1">
              These are missing from the app&apos;s settings in Vercel: <span className="font-mono text-xs">{missing.join(", ")}</span>.
              The step-by-step is in <span className="font-mono text-xs">docs/SQUARE-SYNC.md</span>.
            </p>
          </div>
        )}

        {!conn ? (
          <div className="flex flex-col gap-3">
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden />
                <span>Each sale is filed on the day it happened and tagged to the event running that day, so event profit fills itself in.</span></li>
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden />
                <span>Days you typed in by hand are <strong className="text-foreground">never overwritten</strong> without you saying so.</span></li>
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden />
                <span>Starts with the last 30 days. You can bring in up to a year of history after.</span></li>
            </ul>
            <div>
              {/* A real navigation: it leaves for Square. */}
              <a
                href="/api/square/connect"
                aria-disabled={missing.length > 0}
                className={`lg-press inline-flex h-11 items-center rounded-full bg-highlight px-6 text-[0.95rem] font-medium text-highlight-foreground ${missing.length > 0 ? "pointer-events-none opacity-50" : ""}`}
              >
                Connect Square
              </a>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">Account:</span> <span className="font-medium">{conn.merchantName}</span></p>
                <p className="text-muted-foreground">
                  {locations.length === 1 ? "Location" : "Locations"}: {locations.map((l) => l.name).join(", ")}
                </p>
                <p className="text-muted-foreground">
                  Last sync {since(conn.lastSyncAt)}
                  {last && !last.error && last.ran && !last.note && (
                    <> — {last.ordersRead} orders, {last.daysWritten} days updated{last.partial ? ", more history still coming" : ""}.</>
                  )}
                </p>
                {conn.syncedThroughDay && today && conn.syncedThroughDay < today && (
                  <p className="text-xs text-muted-foreground">Complete through {fmtBusinessDate(conn.syncedThroughDay)}; the rest fills in over the next syncs.</p>
                )}
                {last?.error && <p className="text-destructive">The last sync hit a problem: {last.error}</p>}
                {last?.foreignCurrency ? <p className="text-xs text-muted-foreground">{last.foreignCurrency} sales in another currency were left out.</p> : null}
                {conn.statusNote && <p className="text-destructive">{conn.statusNote}</p>}
              </div>
              <div className="flex flex-wrap items-start gap-2">
                {conn.status === "ACTIVE" ? (
                  <SquareSyncNow />
                ) : (
                  <a href="/api/square/connect" className="lg-press inline-flex h-9 items-center rounded-full bg-highlight px-4 text-sm font-medium text-highlight-foreground">Reconnect</a>
                )}
                <SquareDisconnect />
              </div>
            </div>

            {conn.status === "ACTIVE" && (
              <section aria-labelledby="square-history-h" className="space-y-2">
                <h3 id="square-history-h" className="text-sm font-semibold">Bring in older sales</h3>
                <p className="text-sm text-muted-foreground">
                  Rebuilds those days from Square, replacing anything imported by CSV for them (hand-entered days are still left alone).
                </p>
                <SquareHistory />
              </section>
            )}

            {kept.length > 0 && (
              <section aria-labelledby="square-kept-h" className="rounded-2xl border border-warning-border bg-warning-muted p-4 text-warning-ink">
                <h3 id="square-kept-h" className="text-sm font-semibold">
                  {kept.length === 1 ? "1 day was typed in by hand" : `${kept.length} days were typed in by hand`}, so Square didn&apos;t change {kept.length === 1 ? "it" : "them"}
                </h3>
                <p className="mt-1 text-xs">{kept.map((d) => fmtBusinessDate(d, "MMM d")).join(", ")}</p>
                <div className="mt-3"><UseSquareForDays days={kept} /></div>
              </section>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
