"use client";
import * as React from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { changeOwnPasswordAction } from "@/modules/account/actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="mt-1 w-full" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

export function ChangePasswordForm({ forced, returnTo }: { forced: boolean; returnTo: string }) {
  const router = useRouter();
  const [state, formAction] = useFormState(
    changeOwnPasswordAction,
    null as { error?: string; ok?: boolean } | null,
  );

  /*
    A forced change has to land somewhere — the layout only stops redirecting
    here once the flag is cleared, so a refresh is what actually releases them
    into the app.
  */
  React.useEffect(() => {
    if (!state?.ok) return;
    const t = setTimeout(() => {
      router.replace(returnTo);
      router.refresh();
    }, 900);
    return () => clearTimeout(t);
  }, [state?.ok, router, returnTo]);

  if (state?.ok) {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-success-muted px-3.5 py-3 text-sm text-success">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Password changed. Taking you through…
      </p>
    );
  }

  return (
    <form action={formAction} className="grid gap-3.5">
      <div className="grid gap-1.5">
        <Label htmlFor="currentPassword" className="text-xs text-muted-foreground">
          {forced ? "The password you were given" : "Current password"}
        </Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className="h-12 rounded-2xl px-4 text-sm"
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="newPassword" className="text-xs text-muted-foreground">New password</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          className="h-12 rounded-2xl px-4 text-sm"
        />
        <p className="text-2xs text-muted-foreground">At least {MIN_PASSWORD_LENGTH} characters.</p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="confirmPassword" className="text-xs text-muted-foreground">Repeat new password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          className="h-12 rounded-2xl px-4 text-sm"
        />
      </div>

      {state?.error && (
        <p className="rounded-2xl bg-destructive-muted px-3.5 py-2.5 text-xs text-destructive">{state.error}</p>
      )}

      <Submit label={forced ? "Set my password" : "Change password"} />
    </form>
  );
}
