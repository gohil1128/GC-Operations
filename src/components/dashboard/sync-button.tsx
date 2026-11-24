"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { syncEverythingAction } from "@/modules/sync/actions";

/* Sync from the Overview: Square sales and the invoice scan, then the page refreshes. */
export function SyncButton() {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={pending ? "Syncing" : "Sync sales and invoices now"}
      title="Sync now"
      onClick={() =>
        start(async () => {
          try {
            const r = await syncEverythingAction();
            toast({ title: r.ok ? "Up to date" : "Sync", description: r.message, variant: r.ok ? undefined : "destructive" });
            router.refresh();
          } catch {
            toast({ title: "Couldn't sync", description: "Try again in a moment.", variant: "destructive" });
          }
        })
      }
      className="lg-press -mr-1.5 grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-70"
    >
      <RefreshCw className={`h-[18px] w-[18px] ${pending ? "animate-spin" : ""}`} aria-hidden />
    </button>
  );
}
