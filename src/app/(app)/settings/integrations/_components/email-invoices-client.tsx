"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import {
  approveMailMessageAction, disconnectMailAction, dismissMailMessageAction, scanNowAction,
} from "@/modules/mail/actions";

type Reply = { ok: boolean; message: string };

/* One place for "run an action, say how it went", so every button here reports
   the same way and a screen reader hears the result. */
function useAction({ toastOnSuccess = false }: { toastOnSuccess?: boolean } = {}) {
  const [pending, start] = React.useTransition();
  const [reply, setReply] = React.useState<Reply | null>(null);
  const run = (fn: () => Promise<Reply>) =>
    start(async () => {
      setReply(null);
      try {
        const r = await fn();
        setReply(r);
        // A confirmation that lives on the row it confirms is lost the moment
        // the action works: the list refreshes and the row — and its message —
        // is gone. A toast outlives it. Failures stay inline, where the thing
        // that needs retrying still is.
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

export function ScanNowButton() {
  const { pending, reply, run } = useAction();
  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button size="sm" disabled={pending} onClick={() => run(scanNowAction)}>
        {pending ? "Scanning…" : "Scan now"}
      </Button>
      <Note reply={reply} />
    </div>
  );
}

export function DisconnectButton() {
  const { pending, reply, run } = useAction({ toastOnSuccess: true });
  const [sure, setSure] = React.useState(false);
  return (
    <div className="flex flex-col items-start gap-1.5">
      {sure ? (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="destructive" disabled={pending} onClick={() => run(disconnectMailAction)}>
            {pending ? "Disconnecting…" : "Yes, disconnect"}
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setSure(false)}>
            Keep it
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setSure(true)}>
          Disconnect
        </Button>
      )}
      <Note reply={reply} />
    </div>
  );
}

export function ReviewActions({
  id, suppliers, suggestedSupplierId, canApprove, fromAddress,
}: {
  id: string;
  suppliers: { id: string; name: string }[];
  suggestedSupplierId: string | null;
  canApprove: boolean;
  fromAddress: string;
}) {
  const { pending, reply, run } = useAction({ toastOnSuccess: true });
  const [supplierId, setSupplierId] = React.useState(suggestedSupplierId ?? "");
  const [remember, setRemember] = React.useState(true);

  return (
    <div className="mt-3 flex flex-col gap-2.5">
      {canApprove && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor={`sup-${id}`}>Supplier</label>
          <select
            id={`sup-${id}`}
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="select-native h-11"
          >
            <option value="">Which supplier is this?</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <label className="flex min-h-11 items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--highlight))]" />
            Trust {fromAddress || "this sender"} from now on
          </label>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {canApprove && (
          <Button size="lg" disabled={pending || !supplierId} onClick={() => run(() => approveMailMessageAction(id, supplierId, remember))}>
            Log this invoice
          </Button>
        )}
        <Button size="lg" variant="outline" disabled={pending} onClick={() => run(() => dismissMailMessageAction(id))}>
          Not an invoice
        </Button>
      </div>
      <Note reply={reply} />
    </div>
  );
}
