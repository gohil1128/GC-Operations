"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Lock, Unlock, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  setSectionPinAction,
  removeSectionPinAction,
  setLockedSectionsAction,
  lockSectionsAction,
} from "@/modules/section-lock/actions";
import { SECTIONS, type SectionKey } from "@/modules/section-lock/sections";
import { toast } from "@/components/ui/use-toast";

export function SectionLockCard({
  hasPin,
  locked,
}: {
  hasPin: boolean;
  locked: SectionKey[];
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [pin, setPin] = React.useState("");
  const [sel, setSel] = React.useState<SectionKey[]>(locked);

  // Server state wins after a refresh.
  React.useEffect(() => setSel(locked), [locked]);

  const run = (fn: () => Promise<unknown>, ok: string) =>
    start(async () => {
      try {
        await fn();
        toast({ title: ok });
        router.refresh();
      } catch (err: any) {
        toast({ title: "Failed", description: String(err?.message ?? err), variant: "destructive" });
      }
    });

  const toggle = (key: SectionKey) => {
    const next = sel.includes(key) ? sel.filter((k) => k !== key) : [...sel, key];
    setSel(next);
    run(() => setLockedSectionsAction(next), next.includes(key) ? "Section locked" : "Section unlocked");
  };

  const setPinSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(pin)) {
      toast({ title: "PIN must be 4 digits", variant: "destructive" });
      return;
    }
    const fd = new FormData();
    fd.set("pin", pin);
    run(() => setSectionPinAction(fd), hasPin ? "PIN updated" : "PIN set");
    setPin("");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {hasPin ? (
          <>
            <Lock className="h-4 w-4 text-warning" />
            <Badge variant="warning">
              {sel.length === 0 ? "PIN set · nothing locked" : `${sel.length} section${sel.length === 1 ? "" : "s"} locked`}
            </Badge>
          </>
        ) : (
          <>
            <Unlock className="h-4 w-4 text-muted-foreground" />
            <Badge variant="muted">Open</Badge>
          </>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        One PIN guards whichever sections you tick. Unlocking opens all of them for 60 minutes.
      </p>

      <fieldset disabled={!hasPin || pending} className="space-y-2 disabled:opacity-50">
        <legend className="sr-only">Sections to lock</legend>
        {SECTIONS.map((s) => (
          <label key={s.key} className="touch-target flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[hsl(var(--espresso))]"
              checked={sel.includes(s.key)}
              onChange={() => toggle(s.key)}
            />
            {s.label}
          </label>
        ))}
        {!hasPin && (
          <p className="text-2xs text-muted-foreground">Set a PIN first to choose sections.</p>
        )}
      </fieldset>

      <form onSubmit={setPinSubmit} className="grid items-end gap-2 sm:grid-cols-[auto_auto]">
        <div className="grid gap-1.5">
          <Label htmlFor="section-pin-set">{hasPin ? "Change PIN (4 digits)" : "Set PIN (4 digits)"}</Label>
          {/* Masked for the same reason as the gate itself: this is set at the
              counter, and a PIN typed in the clear here is one somebody behind
              you now knows. The vendor attributes keep password managers from
              capturing it on the way past. */}
          <Input
            id="section-pin-set"
            type="password"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            data-bwignore
            data-form-type="other"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className="num w-32 text-center tracking-[0.4em]"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={pending || pin.length !== 4}>
            {hasPin ? "Update PIN" : "Set PIN"}
          </Button>
          {hasPin && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => run(lockSectionsAction, "Locked")}
                disabled={pending}
              >
                <Lock className="h-3.5 w-3.5" /> Lock now
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => run(removeSectionPinAction, "PIN removed — all sections open")}
                disabled={pending}
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove PIN
              </Button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
