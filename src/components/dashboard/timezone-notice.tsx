"use client";
import * as React from "react";
import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";

/*
  Tells a business it is keeping books in the wrong timezone.

  The setting has existed for a while and is correct in every calculation that
  reads it. The problem was that nobody knew to read it: a business created
  before it was a question inherits America/New_York, and nothing anywhere on
  the app said so. A stall trading in Saskatoon had every evening's takings
  measured against a clock two hours ahead of the one it was trading on, and
  the only symptom was a close occasionally filed under the wrong day — which
  looks like somebody mistyping a date, not like a setting.

  The browser knows where the person actually is, so the two can simply be
  compared. That is a weaker signal than it looks — an owner checking figures
  from a holiday is not evidence of anything — so this suggests rather than
  corrects, and it never changes the setting itself.

  Dismissal is keyed on both zones, so it comes back if either one moves.
  Deliberately not stored on the business: it is advice to whoever is reading,
  and one person waving it away should not hide a misconfiguration from
  everybody else who could fix it.
*/
export function TimezoneNotice({ businessTimezone }: { businessTimezone: string }) {
  const [deviceTimezone, setDeviceTimezone] = React.useState<string | null>(null);
  const [dismissed, setDismissed] = React.useState(true);

  /*
    After mount, not during render: the server has no browser timezone, so
    deciding this while rendering would disagree with the markup it sent.
  */
  React.useEffect(() => {
    let here: string | undefined;
    try {
      here = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!here || here === businessTimezone) return;
    // Same clock, different name — America/Toronto and America/New_York keep
    // identical time, and a business set to one while the phone says the other
    // has nothing wrong with it. Only a genuine difference in the date is
    // worth interrupting anybody over.
    if (sameDay(here, businessTimezone)) return;
    setDeviceTimezone(here);
    try {
      setDismissed(window.localStorage.getItem(key(businessTimezone, here)) === "1");
    } catch {
      setDismissed(false);
    }
  }, [businessTimezone]);

  if (!deviceTimezone || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(key(businessTimezone, deviceTimezone), "1");
    } catch {
      /* private browsing — the notice simply returns next time */
    }
  };

  /*
    One line, with the reasoning one tap away.

    The full explanation used to be the notice — four sentences that ran to
    seven lines on a phone, which together with the cash-close banner put
    most of a screen of warnings above the first figure. The facts that
    decide anything (which timezone the books use, which one you are in, and
    where to change it) fit on one line; the why is kept, verbatim, behind a
    disclosure for anyone who needs it. Same family as the cash-close banner,
    so the two read as one kind of thing rather than two competing styles.
  */
  return (
    <div className="rounded-[18px] border border-warning-border bg-warning-muted px-3.5 py-2 text-[12.5px] text-warning-ink">
      <div className="flex items-center gap-3">
        <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-amber text-amber-foreground">
          <AlertTriangle className="h-3 w-3" aria-hidden />
        </span>
        <p className="min-w-0 flex-1">
          <b className="font-semibold">Books run on {label(businessTimezone)} time</b>
          <span className="hidden sm:inline"> — this device is on {label(deviceTimezone)}</span>
        </p>
        <Link href="/settings" className="shrink-0 whitespace-nowrap font-semibold text-alert hover:underline relative after:absolute after:-inset-x-2 after:-inset-y-3.5 after:content-['']">
          Change
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss timezone notice"
          // 44px target around a 14px glyph; the negative margin keeps the
          // banner one line tall.
          className="-my-2 -mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-warning-ink/80 hover:text-warning-ink"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      <details className="group pb-1 pl-[34px]">
        <summary className="cursor-pointer list-none text-xs text-warning-ink/80 underline underline-offset-2 group-open:no-underline">
          Why this matters
        </summary>
        <p className="mt-1 leading-relaxed">
          You are on {label(deviceTimezone)}, where it is already <b>{dateIn(deviceTimezone)}</b>,
          while the books still read <b>{dateIn(businessTimezone)}</b>. Which day a cash close, a
          sale or a payout belongs to is decided by the business timezone, so a late market can be
          filed under the wrong day. Change it in Settings if you trade here.
        </p>
      </details>
    </div>
  );
}

function key(business: string, device: string) {
  return `tz-notice:${business}:${device}`;
}

function label(tz: string) {
  return tz.split("/").pop()?.replace(/_/g, " ") ?? tz;
}

function dateIn(tz: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: tz, weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit",
    }).format(new Date());
  } catch {
    return tz;
  }
}

function sameDay(a: string, b: string) {
  try {
    const d = new Date();
    const on = (tz: string) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: tz, dateStyle: "short" }).format(d);
    return on(a) === on(b);
  } catch {
    return false;
  }
}
