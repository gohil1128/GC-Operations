"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { closeInvoiceAction } from "@/modules/invoices/actions";
import { toast } from "@/components/ui/use-toast";

export function ReopenInvoiceButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <Button
      size="sm"
      variant="soft"
      disabled={pending}
      onClick={(e) => {
        e.stopPropagation();
        start(async () => {
          try {
            await closeInvoiceAction(id);
            toast({ title: "Invoice re-opened" });
            router.refresh();
          } catch (err: any) {
            toast({ title: "Failed", description: String(err?.message ?? err), variant: "destructive" });
          }
        });
      }}
    >
      <Unlock /> Re-open
    </Button>
  );
}
