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
import { BrandLogo } from "@/components/brand-logo";
import { GoogleButton, OrDivider } from "../_components/google-button";
import { ChaiMoon } from "../_components/chai-moon";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="mt-1 w-full" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}

export function LoginForm({ googleEnabled, notice }: { googleEnabled: boolean; notice?: string }) {
  const [state, formAction] = useFormState(loginAction, null as { error?: string } | null);
  const [logoFailed, setLogoFailed] = React.useState(false);

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel — espresso radial with the ChaiMoon itself as the hero.
          Deliberately carries no live figures: this page is unauthenticated,
          so real season numbers here would be public. */}
      <div className="relative m-3 hidden overflow-hidden rounded-bento p-10 text-espresso-foreground lg:m-5 lg:flex lg:flex-col"
        style={{ background: "radial-gradient(120% 120% at 0% 100%, #3A4628 0%, #283018 50%, #161B12 100%)" }}
      >
        {/* Small secondary brand mark at the top of the panel. */}
        <div className="relative flex justify-start">
          {!logoFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/logo.png" alt={APP_NAME}
              className="h-16 w-auto"
              style={{ filter: "brightness(3.4) saturate(.4)" }}
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand">
              <UtensilsCrossed className="h-6 w-6" />
            </div>
          )}
        </div>

        {/* The ChaiMoon itself, centered as the hero of the panel. */}
        <div className="flex flex-1 items-center justify-center overflow-hidden">
          <ChaiMoon variant="hero" />
        </div>

        {/* Tagline below the hero moon. */}
        <div className="relative">
          <p className="display-num text-[44px] font-medium leading-[1.05]">
            Every cup,<br />accounted for.
          </p>
          <p className="mt-3.5 max-w-[360px] text-sm leading-relaxed opacity-70">
            Sales, invoices, cash and labor for every event — in one warm back-office.
          </p>
        </div>

        <div className="relative mt-8 text-2xs opacity-50">{APP_NAME}</div>
      </div>

      {/* Form side */}
      <main className="relative flex flex-col items-center overflow-hidden px-6 pb-10 pt-8 sm:px-10 lg:justify-center lg:p-10">
        {/* The ChaiMoon itself as the hero above the form on a phone.
            It sits in the normal flow and is fully visible, so the form
            below it starts below the visible moon with no overlap. The hero
            centers itself (left-1/2, -translate-x-1/2), so this wrapper is a
            plain block: its wider-than-the-screen diameter is clipped equally
            on both sides. */}
        <div className="w-full lg:hidden">
          <ChaiMoon variant="hero" />
        </div>
        <div className="relative z-10 w-full max-w-[380px]">
          {/* Small secondary brand mark on small screens, where the brand panel is hidden. */}
          {!logoFailed && (
            <div className="mb-6 flex justify-center lg:hidden">
              <BrandLogo alt={APP_NAME} className="h-12 w-auto" />
            </div>
          )}
          <h1 className="display-num text-[30px] font-medium">Welcome back</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">Sign in to your back-office</p>

          <form action={formAction} className="mt-7 grid gap-3.5">
            <div className="grid gap-1.5">
              <Label htmlFor="email" className="text-xs text-muted-foreground">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com"
                className="h-12 rounded-2xl px-4 text-sm" />
            </div>
            <div className="grid gap-1.5">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="password" className="text-xs text-muted-foreground">Password</Label>
                <Link href="/forgot-password" className="text-xs text-brand-ink hover:underline">Forgot?</Link>
              </div>
              <Input id="password" name="password" type="password" autoComplete="current-password" required
                className="h-12 rounded-2xl px-4 text-sm" />
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
            <>
              <OrDivider />
              <GoogleButton />
            </>
          )}

          <p className="mt-5 text-center text-xs text-muted-foreground">
            New here?{" "}
            <Link href="/signup" className="text-brand-ink hover:underline">Create an account</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
