"use client";
import { useFormStatus } from "react-dom";
import { googleSignInAction } from "@/modules/auth/actions";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

function Inner({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="lg-press inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-full border border-border bg-card text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
    >
      <GoogleMark />
      {pending ? "Opening Google…" : label}
    </button>
  );
}

/*
  A quiet, outlined button under the form — the form's own button stays the
  loud one. It remembers the browser's timezone in a short-lived cookie first,
  because a business created by Google sign-in has no form to ask on, and every
  business day in the app is derived from the timezone.
*/
export function GoogleButton({ label = "Continue with Google" }: { label?: string }) {
  const rememberTimezone = () => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) document.cookie = `gc_tz=${encodeURIComponent(tz)}; path=/; max-age=600; samesite=lax`;
    } catch { /* the business gets the default and the owner is prompted to check it */ }
  };
  return (
    <form action={googleSignInAction} onSubmit={rememberTimezone}>
      <Inner label={label} />
    </form>
  );
}

export function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3 text-2xs uppercase tracking-[0.12em] text-muted-foreground" role="separator">
      <span className="h-px flex-1 bg-border" />
      or
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
