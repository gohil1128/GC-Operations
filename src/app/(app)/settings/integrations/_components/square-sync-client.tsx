"use client";
import * as React from "react";
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
  { days: 90, label: "Last 3 months" },
  { days: 180, label: "Last 6 months" },
  { days: 365, label: "Last year" },
];

export function SquareHistory() {
  const { pending, reply, run } = useAction();
  const [days, setDays] = React.useState(90);
  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="square-history">How far back</label>
        <select
          id="square-history"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="h-9 rounded-full border border-input bg-card px-4 text-sm"
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
