import Link from "next/link";
import { Mail, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtDate } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import { getMailOverview } from "@/modules/mail/queries";
import { missingConfig } from "@/modules/mail/service";
import { DisconnectButton, ReviewActions, ScanNowButton } from "./email-invoices-client";

/*
  Email invoices.

  Plain about what this does and does not do, because it is the one feature
  here that reads a mailbox: read-only, scans every three hours, logs a bill
  only when it came from a supplier you have saved and the figures add up, and
  holds everything else for a person.
*/

const FLASH: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: "Gmail is connected. The first scan runs within three hours, or press Scan now." },
  denied: { ok: false, text: "Google was told no, so nothing was connected." },
  "no-permission": { ok: false, text: "The read permission wasn't ticked on Google's screen. Connect again and leave it on." },
  "bad-state": { ok: false, text: "That sign-in link expired or wasn't yours. Start again from here." },
  failed: { ok: false, text: "Connecting didn't work. Try again; if it repeats, check the Google settings in docs/EMAIL-INVOICES.md." },
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

export async function EmailInvoicesCard({
  businessId, flash, canReview,
}: { businessId: string; flash?: string; canReview: boolean }) {
  const overview = await getMailOverview(businessId);
  const missing = missingConfig();
  const note = flash ? FLASH[flash] : undefined;

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Mail className="h-4 w-4" aria-hidden /> Email invoices
          {overview ? (
            <Badge variant={overview.conn.status === "ACTIVE" ? "success" : "danger"}>
              {overview.conn.status === "ACTIVE" ? "Connected" : "Needs reconnecting"}
            </Badge>
          ) : (
            <Badge variant="outline">Not connected</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Reads the inbox every three hours and logs supplier invoices for you. It can only <em>read</em> —
          it cannot send, delete or change anything in the mailbox.
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
              The step-by-step is in <span className="font-mono text-xs">docs/EMAIL-INVOICES.md</span>.
            </p>
          </div>
        )}

        {!overview ? (
          <div className="flex flex-col gap-3">
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden />
                <span>A bill only logs itself when it came <strong className="text-foreground">from an address you&apos;ve saved for a supplier</strong> and Gmail confirms the sender is genuine. Anything else waits for you, so a stranger can&apos;t put an expense in your books.</span></li>
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden />
                <span>Emails are read by an AI to find the invoice figures. Promotions, social and spam are never sent.</span></li>
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden />
                <span>Invoices are logged as totals only (no line items), so your stock counts are never touched.</span></li>
            </ul>
            <div>
              {/* A real navigation, not a client-side link: it leaves for Google. */}
              <a
                href="/api/mail/google/connect"
                aria-disabled={missing.length > 0}
                className={`lg-press inline-flex h-11 items-center rounded-full bg-highlight px-6 text-[0.95rem] font-medium text-highlight-foreground ${missing.length > 0 ? "pointer-events-none opacity-50" : ""}`}
              >
                Connect Gmail
              </a>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">Mailbox:</span> <span className="font-medium">{overview.conn.accountEmail}</span></p>
                <p className="text-muted-foreground">
                  Last scan {since(overview.conn.lastScanAt)}
                  {overview.lastRun && !overview.lastRun.error && (
                    <> — {overview.lastRun.logged} logged, {overview.lastRun.queued} waiting, {overview.lastRun.skipped} not invoices
                      {overview.lastRun.failed > 0 && `, ${overview.lastRun.failed} failed`}.</>
                  )}
                </p>
                {overview.lastRun?.error && <p className="text-destructive">The last scan hit a problem: {overview.lastRun.error}</p>}
                {overview.conn.statusNote && <p className="text-destructive">{overview.conn.statusNote}</p>}
                {overview.skippedThisWeek > 0 && (
                  <p className="text-xs text-muted-foreground">{overview.skippedThisWeek} other emails this week were looked at and weren&apos;t invoices.</p>
                )}
              </div>
              <div className="flex flex-wrap items-start gap-2">
                {overview.conn.status === "ACTIVE" ? (
                  <ScanNowButton />
                ) : (
                  <a href="/api/mail/google/connect" className="lg-press inline-flex h-9 items-center rounded-full bg-highlight px-4 text-sm font-medium text-highlight-foreground">Reconnect</a>
                )}
                <DisconnectButton />
              </div>
            </div>

            <section aria-labelledby="mail-review">
              <h3 id="mail-review" className="text-sm font-semibold">
                Waiting for you {overview.review.length > 0 && <span className="text-muted-foreground">({overview.review.length})</span>}
              </h3>
              {overview.review.length === 0 ? (
                <p className="mt-1.5 text-sm text-muted-foreground">Nothing is waiting. Anything it isn&apos;t sure about will show up here.</p>
              ) : (
                <ul className="mt-2 space-y-3">
                  {overview.review.map((m) => (
                    <li key={m.id} className="rounded-2xl border border-border bg-muted/50 p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <p className="min-w-0 break-words text-sm font-semibold">{m.supplierName ?? m.subject ?? "Unnamed"}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(m.receivedAt, "MMM d")} · {m.fromAddress}</p>
                      </div>
                      <p className="mt-1 break-words text-xs text-muted-foreground">“{m.subject}”</p>
                      {m.figures ? (
                        <p className="mt-2 text-sm">
                          {m.invoiceNumber ? <>#{m.invoiceNumber} · </> : null}
                          <span className="font-semibold tabular-nums">{formatMoney(m.figures.totalCents)}</span>
                          {m.invoiceDate && <span className="text-muted-foreground"> · dated {m.invoiceDate}</span>}
                          {m.attachmentName && <span className="text-muted-foreground"> · {m.attachmentName}</span>}
                        </p>
                      ) : null}
                      <p className="mt-2 rounded-xl bg-warning-muted px-3 py-2 text-xs text-warning-ink"><strong>Why it&apos;s waiting:</strong> {m.reason}</p>
                      <ReviewActions
                        id={m.id}
                        suppliers={overview.suppliers}
                        suggestedSupplierId={m.suggestedSupplierId}
                        canApprove={canReview && Boolean(m.figures)}
                        fromAddress={m.fromAddress}
                      />
                      {canReview && !m.figures && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Its figures can&apos;t be trusted, so it can&apos;t be logged from here —{" "}
                          <Link href="/purchasing/invoices/new" className="font-medium text-foreground underline underline-offset-2">enter it by hand</Link> from the email.
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {overview.activity.length > 0 && (
              <section aria-labelledby="mail-activity">
                <h3 id="mail-activity" className="text-sm font-semibold">Recently</h3>
                <ul className="mt-2 divide-y divide-border-soft text-sm">
                  {overview.activity.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5">
                      <span className="min-w-0 break-words">
                        {a.status === "LOGGED" && a.invoiceId ? (
                          <Link href={`/purchasing/invoices/${a.invoiceId}`} className="font-medium underline-offset-2 hover:underline">
                            Logged {a.totalCents != null ? formatMoney(a.totalCents) : "invoice"}
                          </Link>
                        ) : a.status === "LOGGED" ? (
                          <span className="font-medium">Logged</span>
                        ) : a.status === "DISMISSED" ? (
                          <span className="text-muted-foreground">Dismissed</span>
                        ) : (
                          <span className="text-destructive">Couldn&apos;t read{a.attempts >= 3 ? " (gave up)" : " (will retry)"}</span>
                        )}
                        <span className="text-muted-foreground"> · {a.fromAddress || "an email"}{a.reason ? ` — ${a.reason}` : ""}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">{fmtDate(a.receivedAt, "MMM d")}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
