"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

type Props = {
  action: () => Promise<unknown>;
  itemLabel: string;
  itemName?: string;
  confirmText?: string;
  successMessage?: string;
  size?: "sm" | "default" | "icon" | "icon-sm";
  variant?: "ghost" | "outline" | "destructive" | "danger";
  children?: React.ReactNode;
  refreshAfter?: boolean;
};

export function DeleteButton({
  action,
  itemLabel,
  itemName,
  confirmText,
  successMessage,
  size = "icon-sm",
  variant = "ghost",
  children,
  refreshAfter = true,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const router = useRouter();

  const run = () =>
    start(async () => {
      try {
        await action();
        toast({ title: successMessage ?? `${itemLabel} deleted` });
        setOpen(false);
        if (refreshAfter) router.refresh();
      } catch (err: any) {
        toast({ title: "Could not delete", description: String(err?.message ?? err), variant: "destructive" });
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        onClick={() => setOpen(true)}
        size={size}
        variant={variant}
        aria-label={`Delete ${itemLabel}`}
        className={variant === "ghost" ? "text-muted-foreground hover:text-destructive" : ""}
      >
        {children ?? <Trash2 />}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete {itemLabel}?
          </DialogTitle>
          <DialogDescription>
            {confirmText ?? (
              <>
                This will permanently remove {itemName ? <span className="font-semibold">{itemName}</span> : `this ${itemLabel.toLowerCase()}`} and any related records. This can&apos;t be undone.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button type="button" variant="destructive" onClick={run} disabled={pending}>
            {pending ? "Deleting..." : "Yes, delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
