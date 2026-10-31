"use client";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { resetPasswordWithTokenAction } from "@/modules/auth/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="mt-1 w-full" disabled={pending}>
      {pending ? "Saving…" : "Set new password"}
    </Button>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useFormState(
    resetPasswordWithTokenAction,
    null as { error?: string; ok?: boolean } | null,
  );

  if (state?.ok) {
    return (
      <div className="grid gap-3.5">
        <p className="flex items-center gap-2 rounded-2xl bg-success-muted px-3.5 py-3 text-sm text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Password set. You can sign in with it now.
        </p>
        <Link
          href="/login"
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-espresso text-sm font-medium text-espresso-foreground"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-3.5">
      <input type="hidden" name="token" value={token} />
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
      <Submit />
    </form>
  );
}
