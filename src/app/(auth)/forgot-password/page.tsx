"use client";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AuthCard } from "../_components/auth-card";
import { requestPasswordResetAction } from "@/modules/auth/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="mt-1 w-full" disabled={pending}>
      {pending ? "Sending…" : "Send reset link"}
    </Button>
  );
}

/*
  The reply is the same whether or not the address has an account — a reset
  form that answers differently is a way to find out who works here. That is
  also why the acknowledgement names the fallback (ask an owner) rather than
  promising an email that may not be deliverable.
*/
export default function ForgotPasswordPage() {
  const [state, formAction] = useFormState(
    requestPasswordResetAction,
    null as { error?: string; ok?: boolean; message?: string } | null,
  );

  return (
    <AuthCard
      title="Reset your password"
      description="Enter the address you sign in with and we'll send a link to choose a new password."
      footer={<Link href="/login" className="hover:underline">Back to sign in</Link>}
    >
      {state?.ok ? (
        <p className="rounded-2xl bg-success-muted px-3.5 py-3 text-[13px] leading-relaxed text-success">
          {state.message}
        </p>
      ) : (
        <form action={formAction} className="grid gap-3.5">
          <div className="grid gap-1.5">
            <Label htmlFor="email" className="text-xs text-muted-foreground">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              className="h-12 rounded-2xl px-4 text-sm"
            />
          </div>
          {state?.error && (
            <p className="rounded-2xl bg-destructive-muted px-3.5 py-2.5 text-xs text-destructive">{state.error}</p>
          )}
          <Submit />
        </form>
      )}
    </AuthCard>
  );
}
