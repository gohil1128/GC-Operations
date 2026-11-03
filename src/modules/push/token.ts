import { createHmac, timingSafeEqual } from "node:crypto";

/*
  The ticket inside a "someone asked to join" notification.

  Tapping Approve or Decline on a notification runs in the phone's service
  worker, not in a page, so there is no form, no CSRF token and no session you
  can rely on. What authorises the tap is this: a signed, short-lived value that
  names ONE action on ONE waiting person, issued to ONE owner. It can approve or
  decline that person and nothing else, and Approve from here is always Staff
  (the lowest role) because there is nowhere on a notification to choose one.

  Signed with the app's auth secret (a separate purpose prefix, so it can never
  be mistaken for the section-unlock cookie or a session), and it expires, so a
  notification left on a lock screen for a week stops working.
*/

export type DecisionAction = "approve" | "decline";
const TTL_MS = 3 * 24 * 60 * 60 * 1000;

function secret(): string {
  const s = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET (or NEXTAUTH_SECRET) must be set.");
  return s;
}
const mac = (body: string) => createHmac("sha256", secret()).update(`push-decision:${body}`).digest("base64url");

export function mintDecisionToken(action: DecisionAction, targetUserId: string, approverId: string, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ a: action, t: targetUserId, o: approverId, e: now + TTL_MS })).toString("base64url");
  return `${body}.${mac(body)}`;
}

export type DecisionClaims = { action: DecisionAction; targetUserId: string; approverId: string };

/** The claims of a genuine, unexpired token, or null for anything else. */
export function verifyDecisionToken(token: unknown, now = Date.now()): DecisionClaims | null {
  if (typeof token !== "string") return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const want = Buffer.from(mac(body));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const c = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { a: string; t: string; o: string; e: number };
    if ((c.a !== "approve" && c.a !== "decline") || typeof c.t !== "string" || typeof c.o !== "string" || typeof c.e !== "number") return null;
    if (c.e < now) return null;
    return { action: c.a, targetUserId: c.t, approverId: c.o };
  } catch {
    return null;
  }
}
