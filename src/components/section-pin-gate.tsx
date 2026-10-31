"use client";
import * as React from "react";
import { Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { unlockSectionsAction } from "@/modules/section-lock/actions";
import { toast } from "@/components/ui/use-toast";

/**
 * Shown in place of a locked section. One gate for all of them — unlocking
 * opens every locked section for the hour, so the copy says so rather than
 * implying this PIN only opens the page you happen to be on.
 */
export function SectionPinGate({ title, blurb }: { title: string; blurb: string }) {
  const [pin, setPin] = React.useState("");
  const [pending, start] = React.useTransition();
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Guarded so the fourth keystroke and a stray Enter can't fire two attempts
  // at once — each failure is a rate-limit-free but still pointless round trip,
  // and a double submit would clear the field twice.
  const attempt = React.useCallback(
    (value: string) => {
      if (pending || !/^\d{4}$/.test(value)) return;
      const fd = new FormData();
      fd.set("pin", value);
      start(async () => {
        try {
          const res = await unlockSectionsAction(fd);
          if (res && "error" in res && res.error) {
            toast({ title: res.error, variant: "destructive" });
            setPin("");
            inputRef.current?.focus();
            return;
          }
          // Full reload rather than a client refresh: the unlock lives in a
          // cookie the server action just set, and a refresh races it.
          // Measured — one run in three stayed locked for 4s and only opened
          // on a hard navigation. This is a gate; it must be deterministic,
          // and a reload is imperceptible for a once-an-hour action.
          window.location.reload();
        } catch (err: any) {
          toast({ title: "Unlock failed", description: String(err?.message ?? err), variant: "destructive" });
        }
      });
    },
    [pending],
  );

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value.replace(/\D/g, "").slice(0, 4);
    setPin(next);
    // Four digits is the whole PIN — there is nothing left to confirm, so
    // don't make anyone reach for a button to say so.
    if (next.length === 4) attempt(next);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(pin)) {
      toast({ title: "Enter the 4-digit PIN", variant: "destructive" });
      return;
    }
    attempt(pin);
  };

  return (
    <div className="flex justify-center px-4 pt-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Lock className="h-5 w-5 text-muted-foreground" />
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{blurb}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="section-pin">PIN</Label>
              <Input
                id="section-pin"
                /*
                  Masked, and kept away from every password manager.

                  It was a plain text input, so the PIN sat on screen in
                  half-inch letter-spaced digits — readable across a counter by
                  anyone the lock exists to keep out. Worse, browsers were
                  offering to save it and then suggesting it straight back in a
                  dropdown, which turns the gate into a button.

                  autoComplete alone is widely ignored for this; the vendor
                  attributes are what actually stop 1Password, LastPass and
                  Bitwarden filling or capturing it. The field stays unnamed so
                  there is nothing for a manager to key a saved entry against.
                */
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
                ref={inputRef}
                value={pin}
                onChange={onChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    attempt(pin);
                  }
                }}
                className="num text-center text-2xl tracking-[0.5em]"
                required
              />
            </div>
            {/* No submit button: the fourth digit unlocks. Enter is wired on the
                input itself rather than relying on implicit form submission,
                which browsers only guarantee for a single-input form — this one
                qualifies today, but that is a fragile thing to depend on. */}
            <p className="text-center text-2xs text-muted-foreground" aria-live="polite">
              {pending ? "Checking…" : "Opens every locked section for 60 minutes."}
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
