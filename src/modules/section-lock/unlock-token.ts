import { createHmac, timingSafeEqual } from "node:crypto";

/*
  The unlock cookie, made unforgeable.

  It used to be `String(Date.now())` and nothing else: unlockIsFresh() read the
  cookie, parsed it as a number, and opened every locked section if it was less
  than an hour old. httpOnly keeps JavaScript from reading it, but it is not an
  integrity control — anyone can add a cookie in devtools or send one with curl.
  Demonstrated against a running build: a MANAGER locked out of /recipes got 403
  from /api/exports/recipes, set `sections-unlocked=<epoch millis>`, and the same
  URL returned every costed recipe. The PIN protected nothing.

  The value is now `<issuedAt>.<hmac>`, signed with the app's auth secret and
  bound to the business it was issued for. Forging one requires the secret, and
  a cookie minted for one business is rejected by another.

  Deliberately not a database row. A stateless signed token needs no storage,
  no cleanup and no extra query on a check that runs in the app layout for every
  request — and the thing it guards is a 60-minute convenience window, not a
  session.
*/

const SEPARATOR = ".";

function secret(): string {
  // The same secret NextAuth already requires, so there is no new thing to
  // configure and no chance of a deployment running with an unsigned default.
  const s = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!s) {
    throw new Error(
      "AUTH_SECRET (or NEXTAUTH_SECRET) must be set — the section unlock cookie is signed with it.",
    );
  }
  return s;
}

function sign(issuedAt: number, businessId: string): string {
  return createHmac("sha256", secret())
    .update(`${issuedAt}${SEPARATOR}${businessId}`)
    .digest("hex");
}

/** Mint a cookie value for a business that has just entered the right PIN. */
export function mintUnlockToken(businessId: string, now: number): string {
  return `${now}${SEPARATOR}${sign(now, businessId)}`;
}

/**
 * Is this cookie a genuine, unexpired unlock for this business?
 *
 * Returns false for anything malformed rather than throwing: a stale or
 * hand-edited cookie should re-lock the sections, not break the page that
 * checks them.
 */
export function unlockTokenIsValid(
  raw: string | undefined,
  businessId: string,
  ttlMinutes: number,
  now: number,
): boolean {
  if (!raw) return false;

  const cut = raw.lastIndexOf(SEPARATOR);
  if (cut <= 0) return false;

  const issuedAtRaw = raw.slice(0, cut);
  const provided = raw.slice(cut + 1);

  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt)) return false;

  // A token dated in the future is not a clock skew to tolerate — it is
  // somebody extending their own window.
  if (issuedAt > now) return false;
  if (now - issuedAt > ttlMinutes * 60 * 1000) return false;

  const expected = sign(issuedAt, businessId);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  // Length is checked first because timingSafeEqual throws on a mismatch, and
  // the length of a hex digest is not a secret.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
