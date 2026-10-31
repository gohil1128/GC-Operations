"use client";
import * as React from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { signUpAction, type SignupState } from "@/modules/auth/signup";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="mt-1 w-full" disabled={pending}>
      {pending ? "Creating your back-office…" : "Create account"}
    </Button>
  );
}

export default function SignupPage() {
  const [state, formAction] = useFormState(signUpAction, null as SignupState);
  const [logoFailed, setLogoFailed] = React.useState(false);

  /*
    The browser knows which timezone the person is in; asking them to pick it
    out of a list of six hundred is a worse first impression than getting it
    right and letting them change it in settings. Validated server-side, so a
    forged value cannot land.

    It matters more here than it looks: every business day in the app is derived
    from this, and getting it wrong files an evening market's takings under the
    next day.
  */
  const [timezone, setTimezone] = React.useState("UTC");
  React.useEffect(() => {
    try {
      const guess = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (guess) setTimezone(guess);
    } catch {
      /* keep UTC */
    }
  }, []);

  const errorFor = (field: string) => (state?.field === field ? state.error : null);

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div
        className="relative m-3 hidden overflow-hidden rounded-bento p-10 text-espresso-foreground lg:m-5 lg:flex lg:flex-col lg:justify-between"
        style={{ background: "radial-gradient(120% 120% at 0% 100%, #5A3620 0%, #3A2415 50%, #2A1A10 100%)" }}
      >
        {!logoFailed && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/logo.png" alt="" aria-hidden
            className="pointer-events-none absolute -bottom-16 -right-16 h-[420px] w-auto opacity-[0.07]"
            style={{ filter: "brightness(4)" }}
          />
        )}
        {!logoFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/logo.png" alt=""
            className="h-16 w-auto self-start"
            style={{ filter: "brightness(3.4) saturate(.4)" }}
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand">
            <UtensilsCrossed className="h-6 w-6" />
          </div>
        )}

        <div className="relative">
          <p className="display-num text-[44px] font-medium leading-[1.05]">
            Know what<br />each event made.
          </p>
          <p className="mt-3.5 max-w-[360px] text-sm leading-relaxed opacity-70">
            Sales, invoices, cash and labour — totalled per market, not per month.
          </p>
        </div>

        <div className="relative text-2xs opacity-50">Free while we are getting started.</div>
      </div>

      <main className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[380px]">
          {!logoFailed && (
            <span className="logo-plate mb-6 inline-block lg:hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" className="h-14 w-auto" />
            </span>
          )}
          <h1 className="display-num text-[30px] font-medium">Start your back-office</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Free while we are getting started — no card needed.
          </p>

          <form action={formAction} className="mt-7 grid gap-3.5">
            <input type="hidden" name="timezone" value={timezone} />

            <div className="grid gap-1.5">
              <Label htmlFor="businessName" className="text-xs text-muted-foreground">Business name</Label>
              <Input
                id="businessName" name="businessName" required maxLength={120}
                autoComplete="organization" placeholder="Sunrise Chai"
                className="h-12 rounded-2xl px-4 text-sm"
              />
              {errorFor("businessName") && (
                <p className="text-xs text-destructive">{errorFor("businessName")}</p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="name" className="text-xs text-muted-foreground">Your name</Label>
              <Input
                id="name" name="name" required maxLength={120}
                autoComplete="name" placeholder="Alex Kaur"
                className="h-12 rounded-2xl px-4 text-sm"
              />
              {errorFor("name") && <p className="text-xs text-destructive">{errorFor("name")}</p>}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="email" className="text-xs text-muted-foreground">Email</Label>
              <Input
                id="email" name="email" type="email" required
                autoComplete="email" placeholder="you@example.com"
                className="h-12 rounded-2xl px-4 text-sm"
              />
              {errorFor("email") && <p className="text-xs text-destructive">{errorFor("email")}</p>}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="password" className="text-xs text-muted-foreground">Password</Label>
              <Input
                id="password" name="password" type="password" required
                autoComplete="new-password" minLength={8}
                className="h-12 rounded-2xl px-4 text-sm"
              />
              <span className="text-2xs text-muted-foreground">At least 8 characters.</span>
              {errorFor("password") && <p className="text-xs text-destructive">{errorFor("password")}</p>}
            </div>

            {/* Errors with no field of their own — a rate limit, a race on the
                email — still have to be shown somewhere. */}
            {state?.error && !state.field && (
              <p className="rounded-2xl bg-destructive-muted px-3.5 py-2.5 text-xs text-destructive">
                {state.error}
              </p>
            )}

            <Submit />
          </form>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-brand-ink hover:underline">Sign in</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
