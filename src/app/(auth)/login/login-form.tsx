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
      {/* Brand panel — dark, with logo, the ChaiMoon itself as the hero, and the warm tagline. Deliberately carries no live figures: this page is unauthenticated, so real season numbers here would be public. */}
      <div
        className="relative hidden w-full max-w-[680px] overflow-hidden rounded-bento p-10 text-white lg:m-5 lg:flex lg:flex-col lg:justify-between"
        style={{ background: "radial-gradient(120% 120% at 0% 100%, #3A4628 0%, #283018 50%, #161B12 100%)" }}
      >
        {/* Small secondary brand mark at the top of the panel. */}
        <div className="relative flex justify-start">
          {!logoFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/logo.png" alt={APP_NAME} className="h-16 w-auto" style={{ filter: "brightness(3.4) saturate(.4)" }} onError={() => setLogoFailed(true)} />
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
            Every cup,
            <br />
            accounted for.
          </p>
          <p className="mt-3.5 max-w-[360px] text-sm leading-relaxed opacity-70">
            Sales, invoices, cash and labor for every event — in one warm back-office.
          </p>
        </div>
        {/* Small footer with brand name. */}
        <div className="relative mt-8 text-2xs opacity-50">{APP_NAME}</div>
      </div>
      {/* Form side */}
      <main className="relative flex flex-col items-center overflow-hidden px-6 pb-10 pt-8 sm:px-10 lg:justify-center lg:p-10">
        {/* Mobile only: ChaiMoon as a full-screen background behind the form.
            The "background" variant is a giant 180vmax circle centered in this
            clipped wrapper, so it fills the whole phone screen, keeping its
            foam photo, glow, and slow rotation. A stronger dark gradient scrim
            (black/45 at the top, via black/30 in the middle, to black/55 at the
            bottom) sits between the moon and the form content, so the mobile
            text sits on a darkened moon without hiding the moon entirely.
            Hidden on desktop (lg:hidden), so the brand panel and the desktop
            form are unchanged. */}
        <div aria-hidden className="absolute inset-0 overflow-hidden lg:hidden">
          <ChaiMoon variant="background" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/30 to-black/55" />
        </div>
        {/* Everything below sits above the moon background (relative, z-10),
            in normal flow with no overlap: logo, heading, form, and links. */}
        <div className="relative z-10 w-full max-w-[380px]">
          <div className="mb-6 flex justify-center lg:hidden">
            <BrandLogo alt={APP_NAME} className="h-12 w-auto drop-shadow-[0_1px_6px_rgba(255,255,255,0.7)]" />
          </div>
          <h1 className="display-num text-[30px] font-medium leading-tight text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.65)] lg:text-inherit lg:[text-shadow:none]">Welcome back</h1>
          <p className="mt-1.5 text-[13px] text-white/85 [text-shadow:0_1px_8px_rgba(0,0,0,0.65)] lg:text-muted-foreground lg:[text-shadow:none]">Sign in to your back-office</p>
          <form action={formAction} className="mt-7 grid gap-3.5">
            {notice ? (
              <div role="status" className="rounded-xl bg-white/10 px-4 py-3 text-center text-sm text-white">
                {notice}
              </div>
            ) : null}
            {state?.error ? (
              <div role="alert" className="rounded-xl bg-[#5b1a12] px-4 py-3 text-center text-sm text-[#ffd9c9]">
                {state.error}
              </div>
            ) : null}
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="email" className="text-white/95 [text-shadow:0_1px_8px_rgba(0,0,0,0.65)] lg:text-muted-foreground lg:[text-shadow:none]">
                  Email
                </Label>
                <Link href="/forgot-password" className="text-xs font-medium text-highlight [text-shadow:0_1px_6px_rgba(0,0,0,0.65)] hover:underline lg:text-brand-ink lg:[text-shadow:none]">
                  Forgot?
                </Link>
              </div>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                className="h-12 rounded-2xl border-white/60 bg-white/80 px-4 text-sm shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-md placeholder:text-zinc-600 lg:border-input lg:bg-card lg:shadow-none lg:backdrop-blur-none lg:placeholder:text-muted-foreground"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="password" className="text-white/95 [text-shadow:0_1px_8px_rgba(0,0,0,0.65)] lg:text-muted-foreground lg:[text-shadow:none]">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="h-12 rounded-2xl border-white/60 bg-white/80 px-4 text-sm shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-md lg:border-input lg:bg-card lg:shadow-none lg:backdrop-blur-none"
              />
            </div>
            <Submit />
          </form>
          {googleEnabled ? (
            <>
              {/* Login-only mobile override for the shared divider: the shared
                  OrDivider component itself is untouched, so the sign-up page
                  and desktop colours are unchanged. */}
              <div className="[&>div]:text-white/80 [&>div]:[text-shadow:0_1px_6px_rgba(0,0,0,0.6)] [&>div>span]:bg-white/50 lg:[&>div]:text-muted-foreground lg:[&>div]:[text-shadow:none] lg:[&>div>span]:bg-border">
                <OrDivider />
              </div>
              <GoogleButton />
            </>
          ) : null}
          <p className="mt-8 text-center text-sm text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.65)] lg:text-inherit lg:[text-shadow:none]">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-medium text-highlight [text-shadow:0_1px_6px_rgba(0,0,0,0.65)] hover:underline lg:text-brand-ink lg:[text-shadow:none]">
              Create an account
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
