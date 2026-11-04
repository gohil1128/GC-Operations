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
      <div
        className="relative m-3 hidden overflow-hidden rounded-bento p-10 text-espresso-foreground lg:m-5 lg:flex lg:flex-col"
        style={{ background: "radial-gradient(120% 120% at 0% 100%, #3A4628 0%, #283018 50%, #161B12 100%)" }}
      >
        {/* Small secondary brand mark at the top of the panel. */}
        <div className="relative flex justify-start">
          {!logoFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/logo.png"
              alt={APP_NAME}
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
            Every cup,
            <br />
            accounted for.
          </p>
          <p className="mt-3.5 max-w-[360px] text-sm leading-relaxed opacity-70">
            Sales, invoices, cash and labor for every event — in one warm back-office.
          </p>
        </div>
      </div>
      {/* Right side: the form itself, in a centered column. */}
      <div className="relative flex min-h-screen flex-col items-center justify-center px-6 py-10 sm:px-10 lg:py-16 lg:px-16">
        {/* Mobile only: ChaiMoon as a full-screen background behind the form.
            The "background" variant is a giant 180vmax circle centered in this
            clipped wrapper, so it fills the whole phone screen. A soft dark
            overlay (black/25 with a gentle top-to-bottom gradient) sits over
            the moon so the form stays readable without hiding the moon.
            Hidden on desktop (lg:hidden), so the brand panel and the desktop
            form are unchanged. */}
        <div aria-hidden className="absolute inset-0 overflow-hidden lg:hidden">
          <ChaiMoon variant="background" />
          <div className="absolute inset-0 bg-black/25 bg-gradient-to-b from-black/40 via-black/25 to-black/45" />
        </div>
        {/* Everything below sits above the moon background (relative, z-10),
            in normal flow with no overlap: logo, heading, form, and links. */}
        <div className="relative z-10 flex w-full max-w-md flex-col items-center text-center">
          <div className="relative z-10 flex flex-col items-center lg:-mt-20">
            <BrandLogo logoSrc="/logos/gods-chai-logo.png" alt="God's Chai" width={200} height={56} className="h-10 w-auto drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]" />
          </div>
          <h1 className="mt-8 text-4xl font-semibold text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.55)] lg:[text-shadow:none]">Welcome back</h1>
          <p className="mt-2 text-sm text-white/70 [text-shadow:0_1px_8px_rgba(0,0,0,0.5)] lg:[text-shadow:none]">Sign in to continue to {APP_NAME}.</p>
          <form action={formAction} className="mt-8 w-full space-y-5 text-left">
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
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="email" className="text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.5)] lg:[text-shadow:none]">
                  Email
                </Label>
                <Link href="/forgot-password" className="text-xs font-medium text-[#d99a2b] hover:underline">
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
                className="h-12 w-full rounded-full border border-white/60 bg-white/80 px-5 text-base text-[#1c1408] shadow-[0_10px_30px_rgba(0,0,0,0.25)] outline-none backdrop-blur-md transition placeholder:text-[#1c1408]/50 focus:border-transparent focus:ring-2 focus:ring-[#d99a2b] lg:border-transparent lg:bg-white lg:shadow-[inset_0_0_0_1px_rgba(28,20,8,0.08)] lg:backdrop-blur-none"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.5)] lg:[text-shadow:none]">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="Your password"
                className="h-12 w-full rounded-full border border-white/60 bg-white/80 px-5 text-base text-[#1c1408] shadow-[0_10px_30px_rgba(0,0,0,0.25)] outline-none backdrop-blur-md transition placeholder:text-[#1c1408]/50 focus:border-transparent focus:ring-2 focus:ring-[#d99a2b] lg:border-transparent lg:bg-white lg:shadow-[inset_0_0_0_1px_rgba(28,20,8,0.08)] lg:backdrop-blur-none"
              />
            </div>
            <Submit />
          </form>
          {googleEnabled ? (
            <>
              <OrDivider />
              <GoogleButton />
            </>
          ) : null}
          <p className="mt-8 text-center text-sm text-white/70">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-medium text-[#d99a2b] hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
