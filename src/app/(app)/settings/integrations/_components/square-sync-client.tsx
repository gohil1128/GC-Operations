"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { tagUntaggedDaysAction } from "@/modules/imports/actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import {
  disconnectSquareAction, importSquareHistoryAction, syncSquareNowAction, replaceManualDaysWithSquareAction,
} from "@/modules/square/actions";

type Reply = { ok: boolean; message: string };

function useAction({ toastOnSuccess = false }: { toastOnSuccess?: boolean } = {}) {
  const [pending, start] = React.useTransition();
  const [reply, setReply] = React.useState<Reply | null>(null);
  const run = (fn: () => Promise<Reply>) =>
    start(async () => {
      setReply(null);
      try {
        const r = await fn();
        setReply(r);
        if (toastOnSuccess && r.ok) toast({ title: r.message });
      } catch {
        setReply({ ok: false, message: "That didn't go through. Try again." });
      }
    });
  return { pending, reply, run };
}

const Note = ({ reply }: { reply: Reply | null }) => (
  <p role="status" aria-live="polite" className={reply ? (reply.ok ? "text-xs text-success" : "text-xs text-destructive") : "sr-only"}>
    {reply?.message}
  </p>
);

export function SquareSyncNow() {
  const { pending, reply, run } = useAction();
  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button size="sm" disabled={pending} onClick={() => run(syncSquareNowAction)}>
        {pending ? "Syncing…" : "Sync now"}
      </Button>
      <Note reply={reply} />
    </div>
  );
}

const HISTORY = [
  { days: 7, label: "Last week" },
  { days: 30, label: "Last month" },
  { days: 90, label: "Last 3 months" },
  { days: 180, label: "Last 6 months" },
  { days: 365, label: "Last year" },
];

export function SquareHistory() {
  const { pending, reply, run } = useAction();
  const [days, setDays] = React.useState(30);
  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="square-history">How far back</label>
        <select
          id="square-history"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="select-native h-10"
        >
          {HISTORY.map((h) => <option key={h.days} value={h.days}>{h.label}</option>)}
        </select>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => importSquareHistoryAction(days))}>
          {pending ? "Importing…" : "Import history"}
        </Button>
      </div>
      <Note reply={reply} />
    </div>
  );
}

export function UseSquareForDays({ days }: { days: string[] }) {
  const { pending, reply, run } = useAction({ toastOnSuccess: true });
  const [sure, setSure] = React.useState(false);
  return (
    <div className="flex flex-col items-start gap-1.5">
      {sure ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={pending} onClick={() => run(() => replaceManualDaysWithSquareAction(days))}>
            {pending ? "Replacing…" : `Yes, replace ${days.length === 1 ? "it" : `all ${days.length}`}`}
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setSure(false)}>Keep mine</Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setSure(true)}>Use Square&apos;s figures instead</Button>
      )}
      <Note reply={reply} />
    </div>
  );
}

export function SquareDisconnect() {
  const { pending, reply, run } = useAction({ toastOnSuccess: true });
  const [sure, setSure] = React.useState(false);
  return (
    <div className="flex flex-col items-start gap-1.5">
      {sure ? (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="destructive" disabled={pending} onClick={() => run(disconnectSquareAction)}>
            {pending ? "Disconnecting…" : "Yes, disconnect"}
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setSure(false)}>Keep it</Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setSure(true)}>Disconnect</Button>
      )}
      <Note reply={reply} />
    </div>
  );
}

/* Days Square brought in with no event: pick one and tag them all, or go to Imported days for a range or one day at a time. */
export function TagUntaggedDays({ count, events }: { count: number; events: { id: string; name: string }[] }) {
  const router = useRouter();
  const [eventId, setEventId] = React.useState(events[0]?.id ?? "");
  const [pending, start] = React.useTransition();
  if (count === 0 || events.length === 0) return null;
  return (
    <div className="rounded-2xl bg-warning-muted px-4 py-3 text-sm text-warning-ink">
      <p className="font-semibold">{count} day{count === 1 ? "" : "s"} of sales {count === 1 ? "has" : "have"} no event</p>
      <p className="mt-0.5 text-xs opacity-90">Square only tags a day itself when exactly one event covers it. Give them one here.</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="tag-untagged-event">Event</label>
        <select id="tag-untagged-event" value={eventId} onChange={(e) => setEventId(e.target.value)} className="select-native h-10 max-w-full">
          {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <Button
          size="sm"
          disabled={pending || !eventId}
          onClick={() =>
            start(async () => {
              try {
                const r = await tagUntaggedDaysAction(eventId);
                toast({ title: `Tagged ${r.days} day${r.days === 1 ? "" : "s"}` });
                router.refresh();
              } catch (e) {
                toast({ title: "Couldn't tag", description: String((e as Error)?.message ?? e), variant: "destructive" });
              }
            })
          }
        >
          {pending ? "Tagging…" : `Tag ${count} day${count === 1 ? "" : "s"}`}
        </Button>
        <Link href="/settings/imported-data" className="text-xs font-medium underline underline-offset-2">Pick days one by one</Link>
      </div>
    </div>
  );
}
