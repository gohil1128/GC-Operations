"use client";
import * as React from "react";
import { Lock, LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { lockSectionWithMyPinAction, setSectionPinAction } from "@/modules/section-lock/actions";

/*
  The tiny lock beside Profit & loss.

  Profit & loss is open to everyone by default. This is the one-tap way for a
  person to put it behind a PIN of their own:
    - no PIN yet: opens a small box to choose one (4 digits); setting it also
      locks Profit & loss for them, and nobody else is affected;
    - has a PIN but P&L isn't locked: one tap locks it with that PIN;
  (The third state, "open only because you entered the PIN", is the existing
  SectionLockButton, which re-locks.)
*/

const iconButton =
  "lg-press relative grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground after:absolute after:-inset-2 after:content-['']";

export function QuickPin({ mode }: { mode: "set" | "lock" }) {
  const [open, setOpen] = React.useState(false);
  const [pin, setPin] = React.useState("");
  const [pending, start] = React.useTransition();

  const done = (title: string) => {
    toast({ title });
    // A reload, not a refresh: locking is a cookie change, and a refresh can
    // render from a payload that still carries the old one.
    window.location.reload();
  };

  if (mode === "lock") {
    return (
      <button
        type="button"
        disabled={pending}
        aria-label="Lock Profit & loss with my PIN"
        title="Lock Profit & loss with my PIN"
        className={iconButton}
        onClick={() =>
          start(async () => {
            try {
              await lockSectionWithMyPinAction("REPORTS");
              done("Profit & loss is locked for you");
            } catch (e) {
              toast({ title: "Couldn't lock it", description: String((e as Error)?.message ?? e), variant: "destructive" });
            }
          })
        }
      >
        <LockOpen className="h-3.5 w-3.5" aria-hidden />
      </button>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(pin)) return;
    const fd = new FormData();
    fd.set("pin", pin);
    start(async () => {
      try {
        await setSectionPinAction(fd);
        setOpen(false);
        done("PIN set — Profit & loss is locked for you");
      } catch (err) {
        toast({ title: "Couldn't set the PIN", description: String((err as Error)?.message ?? err), variant: "destructive" });
      }
    });
  };

  return (
    <>
      <button type="button" aria-label="Add a PIN to Profit & loss" title="Add a PIN to Profit & loss" className={iconButton} onClick={() => setOpen(true)}>
        <LockOpen className="h-3.5 w-3.5" aria-hidden />
      </button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setPin(""); }}>
        <DialogContent>
          <form onSubmit={submit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Lock className="h-4 w-4" aria-hidden /> Add a PIN</DialogTitle>
              <DialogDescription>
                Profit &amp; loss is open to everyone. A PIN hides it on <em>your</em> screen until you enter it. It doesn&apos;t
                change what anyone else sees, and you can remove it any time in Settings.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor="quick-pin">4-digit PIN</Label>
              <Input
                id="quick-pin"
                type="password"
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                data-bwignore
                data-form-type="other"
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                autoFocus
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="num h-12 text-center text-2xl tracking-[0.5em]"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
              <Button type="submit" disabled={pending || pin.length !== 4}>{pending ? "Saving…" : "Set PIN and lock"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
