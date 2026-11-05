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
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}
export function LoginForm({ googleEnabled, notice }: { googleEnabled: boolean; notice?: string }) {
  const [state, formAction] = useFormState(loginAction, null as { error?: string } | null);
  const [logoFailed, setLogoFailed] = React.useState(false);
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel (desktop): the chai moon, massive, filling the lower part of the panel.
          The headline sits up under the logo, on the dark of the panel, and the footer is a
          small chip so nothing is set over the bright foam. Deliberately carries no live
          figures: this page is unauthenticated, so real season numbers here would be public. */}
      <div
        className="relative m-3 hidden overflow-hidden rounded-bento p-10 text-white lg:m-5 lg:flex lg:flex-col"
        style={{ background: "radial-gradient(120% 120% at 0% 100%, #3A4628 0%, #283018 50%, #161B12 100%)" }}
      >
        <ChaiMoon variant="massive" />
        {!logoFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/logo.png" alt={APP_NAME} className="relative h-16 w-auto self-start" style={{ filter: "brightness(3.4) saturate(.4)" }} onError={() => setLogoFailed(true)} />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand">
            <UtensilsCrossed className="h-6 w-6" />
          </div>
        )}
        <div className="relative mt-10">
          <p className="display-num text-[44px] font-medium leading-[1.05]">
            Every cup,
            <br />
            accounted for.
          </p>
          <p className="mt-3.5 max-w-[360px] text-sm leading-relaxed opacity-70">
            Sales, invoices, cash and labor for every event — in one warm back-office.
          </p>
        </div>
        <div className="relative mt-auto w-fit rounded-full bg-black/35 px-3 py-1 text-2xs text-white/80 backdrop-blur">{APP_NAME}</div>
      </div>
      {/* Form side */}
      <main className="relative flex flex-col items-center overflow-hidden px-6 pb-10 pt-8 sm:px-10 lg:justify-center lg:p-10">
        {/* Phone / installed app: the chai moon fills the screen behind the form. The scrim
            over it is the app's own olive-black (the sign-in gradient's darkest colour),
            not plain black, so the moon stays warm and the page stays in the palette.
            Hidden on desktop, where the brand panel carries the moon. */}
        <div aria-hidden className="absolute inset-0 overflow-hidden lg:hidden">
          <ChaiMoon variant="background" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#161B12]/70 via-[#161B12]/55 to-[#161B12]/78" />
        </div>
        {/* In normal flow above the moon (relative, z-10). The colours are the app's: olive
            fields, cream text, lime links and button. On desktop (lg) everything falls back
            to the theme tokens exactly as the page was before the moon went full-screen. */}
        <div className="relative z-10 w-full max-w-[380px]">
          <div className="mb-6 flex justify-center lg:hidden">
            <BrandLogo alt={APP_NAME} className="h-12 w-auto" />
          </div>
          <h1 className="display-num text-[30px] font-medium text-[#F6F5EE] lg:text-inherit">Welcome back</h1>
          <p className="mt-1.5 text-[13px] text-[#C9CBBF] lg:text-muted-foreground">Sign in to your back-office</p>

          <form action={formAction} className="mt-7 grid gap-3.5">
            <div className="grid gap-1.5">
              <Label htmlFor="email" className="text-xs text-[#C9CBBF] lg:text-muted-foreground">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                className="h-12 rounded-2xl border-[#4A5340] bg-[#2B3422]/80 px-4 text-sm text-[#F6F5EE] backdrop-blur-md placeholder:text-[#A9ACA2] lg:border-input lg:bg-card lg:text-foreground lg:backdrop-blur-none lg:placeholder:text-muted-foreground"
              />
            </div>
            <div className="grid gap-1.5">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="password" className="text-xs text-[#C9CBBF] lg:text-muted-foreground">Password</Label>
                <Link href="/forgot-password" className="text-xs text-highlight hover:underline lg:text-brand-ink">Forgot?</Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="h-12 rounded-2xl border-[#4A5340] bg-[#2B3422]/80 px-4 text-sm text-[#F6F5EE] backdrop-blur-md lg:border-input lg:bg-card lg:text-foreground lg:backdrop-blur-none"
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
            <>
              <OrDivider />
              <GoogleButton />
            </>
          )}

          <p className="mt-5 text-center text-xs text-[#C9CBBF] lg:text-muted-foreground">
            New here?{" "}
            <Link href="/signup" className="text-highlight hover:underline lg:text-brand-ink">Create an account</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
