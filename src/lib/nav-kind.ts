/*
  How the current navigation started, so the page knows whether to play its
  entrance.

  A page fades and rises in when you TAP to it. It must not when something else
  has already animated the change:

    "swipe"    a tab swipe slid the next screen in under your finger, and the
               real page is only being swapped in behind it.
    "history"  the browser's own back/forward gesture (the iPhone edge swipe)
               has just drawn the previous screen sliding back.

  Playing the entrance on top of either one animates the same arrival twice,
  which is what read as a second, laggy fade in the recording.

  A mark is one-shot, and it expires: a back gesture that lands on the same
  path never changes it, and must not leave the NEXT tap silently without its
  entrance. A swipe waits as long as the page may take to arrive on a slow
  connection (the swipe gives up on it at 6s); a back gesture lands at once.
*/

export type NavKind = "swipe" | "history";

const TTL_MS: Record<NavKind, number> = { swipe: 8000, history: 1500 };
let mark: { kind: NavKind; at: number } | null = null;

export function markNavigation(kind: NavKind, now: number = Date.now()): void {
  mark = { kind, at: now };
}

/** The kind of navigation just started, or null for an ordinary tap. Reading it clears it. */
export function takeNavigationKind(now: number = Date.now()): NavKind | null {
  const m = mark;
  mark = null;
  return m && now - m.at <= TTL_MS[m.kind] ? m.kind : null;
}
