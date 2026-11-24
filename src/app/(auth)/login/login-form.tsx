"use client";
import * as React from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { loginAction } from "@/modules/auth/actions";
import { APP_NAME } from "@/lib/brand";
import { GoogleButton, OrDivider } from "../_components/google-button";
import { LoginFloat } from "@/components/login-float";
import { LoginVideo } from "@/components/login-video";
function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="login-submit w-full" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}
export function LoginForm({ googleEnabled, notice }: { googleEnabled: boolean; notice?: string }) {
  const [state, formAction] = useFormState(loginAction, null as { error?: string } | null);
  const [logoFailed, setLogoFailed] = React.useState(false);
  return (
    <div className="login-scene">
      {/* Chai simmering, an 8-second silent loop, full screen under a cocoa scrim so the cream type stays
          readable. Deliberately no live figures: this page is unauthenticated, so real season numbers here
          would be public. */}
      <div aria-hidden className="login-stage">
        <LoginVideo className="login-video" />
        <div className="login-scrim" />
      </div>
      <p aria-hidden className="display-num login-tagline">
        Every cup,
        <br />
        accounted for.
      </p>

      <main className="login-main">
        <LoginFloat>
          {!logoFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/logo.png" alt={APP_NAME} className="login-logo" onError={() => setLogoFailed(true)} />
          ) : (
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white">
              <UtensilsCrossed className="h-6 w-6" />
            </div>
          )}
          <h1 className="display-num text-[30px] font-medium">Welcome back</h1>
          <p className="login-muted mt-1.5 text-[13px]">Sign in to your back-office</p>

          <form action={formAction} className="mt-7 grid gap-3.5">
            <div className="grid gap-1.5">
              <Label htmlFor="email" className="text-xs">Email</Label>
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
            <div className="grid gap-1.5">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="password" className="text-xs">Password</Label>
                <Link href="/forgot-password" className="login-link text-xs hover:underline">Forgot?</Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="h-12 rounded-2xl px-4 text-sm"
              />
            </div>

            {state?.error && (
              <p className="rounded-2xl bg-destructive-muted px-3.5 py-2.5 text-xs text-destructive">{state.error}</p>
            )}

            {!state?.error && notice && (
              <p role="alert" className="rounded-2xl bg-destructive-muted px-3.5 py-2.5 text-xs text-destructive">{notice}</p>
            )}

            <Submit />
          </form>

          {googleEnabled && (
            <div className="login-alt">
              <OrDivider />
              <GoogleButton />
            </div>
          )}

          <p className="login-muted mt-5 text-center text-xs">
            New here?{" "}
            <Link href="/signup" className="login-link hover:underline">Create an account</Link>
          </p>
        </LoginFloat>
      </main>
      <p aria-hidden className="login-foot">{APP_NAME}</p>
    </div>
  );
}
