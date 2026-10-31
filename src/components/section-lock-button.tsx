"use client";
import * as React from "react";
import { Lock } from "lucide-react";
import { lockSectionsAction } from "@/modules/section-lock/actions";

/**
 * Minimal re-lock control, shown inside a section that is only open because
 * the PIN was entered. Icon only — but the label still exists for screen
 * readers and as a hover tooltip, because dropping the visible text would
 * otherwise leave the button with no accessible name at all.
 *
 * Locking closes every unlocked section at once, which is the same scope the
 * unlock had, so the label says "sections" rather than "this page".
 */
export function SectionLockButton() {
  const [pending, start] = React.useTransition();
  const label = pending ? "Locking sections" : "Lock sections";

  return (
    <button
      type="button"
      disabled={pending}
      aria-label={label}
      title={label}
      onClick={() =>
        start(async () => {
          await lockSectionsAction();
          // Full reload rather than a client refresh: locking is a cookie
          // deletion, and a refresh can render from a payload that still
          // carries it.
          window.location.reload();
        })
      }
      className="touch-target grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60"
    >
      <Lock className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}
