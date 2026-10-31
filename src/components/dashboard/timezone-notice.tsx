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

  return (
    <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-xs">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
      <div className="flex-1 space-y-1">
        <p className="font-medium text-foreground">
          This business keeps its books on {label(businessTimezone)} time
        </p>
        <p className="leading-relaxed text-muted-foreground">
          You are on {label(deviceTimezone)}, where it is already{" "}
          <span className="text-foreground">{dateIn(deviceTimezone)}</span> while the books still
          read <span className="text-foreground">{dateIn(businessTimezone)}</span>. Which day a
          cash close, a sale or a payout belongs to is decided by the business timezone, so a late
          market can be filed under the wrong day.{" "}
          <Link href="/settings" className="font-medium text-foreground underline underline-offset-2">
            Change it in Settings
          </Link>{" "}
          if you trade here.
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss timezone notice"
        className="-m-1 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
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
