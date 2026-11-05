"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { approveUserAction, declineUserAction } from "@/modules/users/actions";

export type JoinRequest = { id: string; name: string; email: string; requestedAt: string };

/*
  People who signed in with Google and asked to join. Each gets a role (Staff
  unless you choose otherwise) and Approve, or Decline. Nothing is open to them
  until you do.
*/
export function JoinRequests({ requests }: { requests: JoinRequest[] }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [roles, setRoles] = React.useState<Record<string, "STAFF" | "MANAGER">>({});

  if (requests.length === 0) return null;

  const run = (fn: () => Promise<{ ok: true } | { error: string }>, done: string) =>
    start(async () => {
      const res = await fn();
      if ("error" in res) toast({ title: "Couldn't do that", description: res.error, variant: "destructive" });
      else { toast({ title: done }); router.refresh(); }
    });

  return (
    <section aria-labelledby="join-h" className="bento mb-4 border-warning-border bg-warning-muted p-4 text-warning-ink sm:p-5">
      <h2 id="join-h" className="text-sm font-semibold">
        {requests.length === 1 ? "1 person is waiting to join" : `${requests.length} people are waiting to join`}
      </h2>
      <p className="mt-0.5 text-xs opacity-90">They signed in with Google and can see nothing until you approve them.</p>
      <ul className="mt-3 divide-y divide-warning-border">
        {requests.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
            <div className="min-w-0 basis-full sm:flex-1 sm:basis-0">
              <p className="truncate text-sm font-medium">{r.name}</p>
              <p className="truncate text-xs opacity-80">{r.email}</p>
            </div>
            <label className="sr-only" htmlFor={`role-${r.id}`}>Role for {r.name}</label>
            <select
              id={`role-${r.id}`}
              value={roles[r.id] ?? "STAFF"}
              onChange={(e) => setRoles((m) => ({ ...m, [r.id]: e.target.value as "STAFF" | "MANAGER" }))}
              className="select-native h-10 border-warning-border"
            >
              <option value="STAFF">Staff</option>
              <option value="MANAGER">Manager</option>
            </select>
            <Button size="sm" disabled={pending} onClick={() => run(() => approveUserAction(r.id, roles[r.id] ?? "STAFF"), `${r.name} approved`)}>
              <Check /> Approve
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => declineUserAction(r.id), "Request declined")}>
              <X /> Decline
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
