import { prisma } from "@/lib/prisma";

/*
  Login throttling.

  The credentials provider had no limit, so a password could be guessed as fast
  as requests could be made. Counters live in the database rather than memory
  because the app runs on serverless instances that do not share state.

  Two keys are checked per attempt:
    email:<address>  — an attack against one account
    ip:<addr>        — spraying one password across many accounts

  Failures older than the window are forgiven, so an honest user who mistypes
  today is not still one attempt from a lockout next week.
*/

const WINDOW_MS = 15 * 60 * 1000; // failures older than this are forgiven
const EMAIL_MAX = 5; // failures per address before lockout
const IP_MAX = 20; // higher: an office or phone network shares one address
const LOCK_MS = 15 * 60 * 1000;
// Repeat offenders get a longer lock. Expressed as a multiple of the key's own
// threshold: a fixed number would trip before IP_MAX and make that limit dead,
// locking a shared office address for an hour after 10 fumbled staff logins.
const LONG_LOCK_MULTIPLE = 2;
const LONG_LOCK_MS = 60 * 60 * 1000;

export type RateLimitState = { locked: true; retryAfterSec: number } | { locked: false };

export function loginKeys(email: string, ip: string | null): string[] {
  const keys = [`email:${email.trim().toLowerCase()}`];
  if (ip) keys.push(`ip:${ip}`);
  return keys;
}

/** Best-effort client address from the proxy chain. */
export function clientIpFrom(headers: Headers): string | null {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim() || null;
  return headers.get("x-real-ip");
}

/**
 * Is this attempt currently locked out? Checked BEFORE verifying the password,
 * and deliberately identical whether or not the address exists — otherwise the
 * lockout itself would reveal which addresses are real.
 */
export async function checkLoginAllowed(keys: string[]): Promise<RateLimitState> {
  const now = new Date();
  const rows = await prisma.loginAttempt.findMany({ where: { key: { in: keys } } });
  let until: Date | null = null;
  for (const r of rows) {
    if (r.lockedUntil && r.lockedUntil > now && (!until || r.lockedUntil > until)) {
      until = r.lockedUntil;
    }
  }
  if (!until) return { locked: false };
  return { locked: true, retryAfterSec: Math.ceil((until.getTime() - now.getTime()) / 1000) };
}

/** Record a failed attempt against every key, locking once a threshold trips. */
export async function recordLoginFailure(keys: string[], email: string): Promise<void> {
  const now = new Date();
  await Promise.all(
    keys.map(async (key) => {
      const isEmailKey = key.startsWith("email:");
      const max = isEmailKey ? EMAIL_MAX : IP_MAX;
      const existing = await prisma.loginAttempt.findUnique({ where: { key } });

      // Stale counters reset so an old mistake does not linger.
      const stale = existing ? now.getTime() - existing.updatedAt.getTime() > WINDOW_MS : false;
      const failures = (stale || !existing ? 0 : existing.failures) + 1;
      const lockedUntil =
        failures >= max * LONG_LOCK_MULTIPLE
          ? new Date(now.getTime() + LONG_LOCK_MS)
          : failures >= max
            ? new Date(now.getTime() + LOCK_MS)
            : null;

      await prisma.loginAttempt.upsert({
        where: { key },
        create: { key, failures, lockedUntil },
        update: { failures, lockedUntil },
      });
    }),
  );
  void email;
}

/** A correct password clears the record for that address (and its address). */
export async function clearLoginFailures(keys: string[]): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { key: { in: keys } } });
}

/** Thrown by `authorize` so the sign-in form can explain the wait. */
export class LoginLockedError extends Error {
  constructor(public retryAfterSec: number) {
    super("LOGIN_LOCKED");
    this.name = "LoginLockedError";
  }
}

/*
  The section PIN uses the same counter table, in its own key namespace.

  Thresholds differ from login on purpose. The PIN is four digits, so the space
  is ten thousand — small enough that five tries per window is generous for an
  honest owner who has forgotten it and hostile to anyone working through it.
  The business-wide key is looser than the per-user one so a large team fumbling
  the PIN on a busy day does not lock the whole business out, while still
  capping a guess campaign spread across several accounts.
*/
const SECTION_PIN_USER_MAX = 5;
const SECTION_PIN_BUSINESS_MAX = 20;

export async function checkSectionPinAllowed(keys: string[]): Promise<RateLimitState> {
  // The lockout question is identical for any key namespace, so this reuses the
  // login check rather than keeping a second copy of the same expiry logic.
  return checkLoginAllowed(keys);
}

export async function recordSectionPinFailure(keys: string[]): Promise<void> {
  const now = new Date();
  await Promise.all(
    keys.map(async (key) => {
      const max = key.startsWith("sectionpin:user:")
        ? SECTION_PIN_USER_MAX
        : SECTION_PIN_BUSINESS_MAX;
      const existing = await prisma.loginAttempt.findUnique({ where: { key } });
      const stale = existing ? now.getTime() - existing.updatedAt.getTime() > WINDOW_MS : false;
      const failures = (stale || !existing ? 0 : existing.failures) + 1;
      const lockedUntil =
        failures >= max * LONG_LOCK_MULTIPLE
          ? new Date(now.getTime() + LONG_LOCK_MS)
          : failures >= max
            ? new Date(now.getTime() + LOCK_MS)
            : null;
      await prisma.loginAttempt.upsert({
        where: { key },
        create: { key, failures, lockedUntil },
        update: { failures, lockedUntil },
      });
    }),
  );
}

export async function clearSectionPinFailures(keys: string[]): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { key: { in: keys } } });
}

/*
  Signup, throttled per address.

  A public endpoint that CREATES rows needs a different limit from one that
  merely checks a password: the abuse is not guessing, it is volume. So every
  attempt is recorded, successful ones included — otherwise a script could
  create businesses all day without ever tripping a failure counter.

  Five an hour per address is well clear of anything a person does (nobody
  founds six businesses in an afternoon) and closes the door on a loop.
*/
/*
  Overridable, because a test suite legitimately creates several businesses in a
  row and would otherwise be throttled by the very control it is checking — the
  same trap the login limiter set for CI. The default is the production value;
  an environment that raises it is choosing to, in writing.
*/
const SIGNUP_MAX_PER_IP = Number(process.env.SIGNUP_MAX_PER_IP ?? 5);
const SIGNUP_WINDOW_MS = 60 * 60 * 1000;

export function signupKeys(ip: string | null): string[] {
  // No address means no bucket to count against — behind a proxy that strips
  // the header this would otherwise lump every signup into one key and lock
  // out the sixth honest customer.
  return ip ? [`signup:ip:${ip}`] : [];
}

export async function checkSignupAllowed(keys: string[]): Promise<RateLimitState> {
  if (keys.length === 0) return { locked: false };
  return checkLoginAllowed(keys);
}

/** Counts an attempt whether or not it succeeded. */
export async function recordSignupAttempt(keys: string[]): Promise<void> {
  const now = new Date();
  await Promise.all(
    keys.map(async (key) => {
      const existing = await prisma.loginAttempt.findUnique({ where: { key } });
      const stale = existing ? now.getTime() - existing.updatedAt.getTime() > SIGNUP_WINDOW_MS : false;
      const failures = (stale || !existing ? 0 : existing.failures) + 1;
      const lockedUntil =
        failures >= SIGNUP_MAX_PER_IP ? new Date(now.getTime() + SIGNUP_WINDOW_MS) : null;
      await prisma.loginAttempt.upsert({
        where: { key },
        create: { key, failures, lockedUntil },
        update: { failures, lockedUntil },
      });
    }),
  );
}
