"use client";
import * as React from "react";
import { Copy, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

/*
  A one-hour, single-use link an owner hands over directly.

  Better than reading out a temporary password, and the way this works at all
  when no email service is configured: the person sets their own password
  without it ever being spoken aloud or written down.
*/
export function ResetLinkDialog({
  name,
  url,
  expiresAt,
  onClose,
}: {
  name: string;
  url: string;
  expiresAt: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: "Link copied" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed — long-press to select instead", variant: "destructive" });
    }
  };

  const expires = new Date(expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset link for {name}</DialogTitle>
          <DialogDescription>
            Send this through any private channel. It works{" "}
            <span className="font-semibold text-foreground">once</span> and stops working at{" "}
            <span className="font-semibold text-foreground">{expires}</span>. They choose their own
            password — you never see it.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5">
          <code className="flex-1 break-all font-mono text-xs">{url}</code>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={copy}>
            {copied ? (
              <><Check className="h-3.5 w-3.5" /> Copied</>
            ) : (
              <><Copy className="h-3.5 w-3.5" /> Copy link</>
            )}
          </Button>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
