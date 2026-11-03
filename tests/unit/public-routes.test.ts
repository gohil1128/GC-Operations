import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/*
  Which routes may be reached without signing in.

  The list is a Set matched EXACTLY, on purpose — a prefix test would make any
  future path starting with "/login" or "/offline" silently public. This test
  pins both halves of that: the routes that must be open, and the ones that must
  never be.

  /signup is the one that made this worth a test. An account-creation page that
  requires an account is an obvious failure, but it fails by REDIRECTING, which
  looks like a routing quirk rather than a broken product.
*/

const middleware = readFileSync("src/middleware.ts", "utf8");

// The literal strings inside the PUBLIC_EXACT set.
const publicExact = new Set(
  [...middleware.matchAll(/^\s*"([^"]+)",\s*$/gm)]
    .map((m) => m[1])
    .filter((s) => s.startsWith("/")),
);

describe("routes reachable without a session", () => {
  for (const path of ["/login", "/signup", "/forgot-password", "/reset-password"]) {
    it(`${path} is public`, () => {
      expect(publicExact.has(path), `${path} must not require a session`).toBe(true);
    });
  }

  it("opens exactly the two scheduler routes, and nothing around them", () => {
    // The mail scanner and the Square sync are called by a scheduler with no
    // login; each guards itself with a bearer secret. Anything NEXT to them
    // must stay behind the session — the OAuth routes above all.
    expect(publicExact.has("/api/cron/scan-invoices")).toBe(true);
    expect(publicExact.has("/api/cron/sync-square")).toBe(true);
    expect([...publicExact].filter((p) => p.startsWith("/api/cron"))).toHaveLength(2);
    for (const path of [
      "/api/cron", "/api/cron/", "/api/cron/anything-else",
      "/api/mail/google/connect", "/api/mail/google/callback",
      "/api/square/connect", "/api/square/callback",
    ]) {
      expect(publicExact.has(path), `${path} must NOT be public`).toBe(false);
    }
  });

  it("opens the notification-decision endpoint only, and not the subscription one", () => {
    // The Approve / Decline buttons on a push notification post a signed ticket
    // from the service worker. Subscribing, which needs a real owner session, must stay private.
    expect(publicExact.has("/api/push/decision")).toBe(true);
    for (const path of ["/api/push", "/api/push/subscribe"]) expect(publicExact.has(path), `${path} must NOT be public`).toBe(false);
  });

  it("keeps the app itself private", () => {
    for (const path of ["/dashboard", "/cash", "/settings", "/reports", "/events", "/sales"]) {
      expect(publicExact.has(path), `${path} must NOT be public`).toBe(false);
    }
  });

  it("matches the exact list by equality, not by prefix", () => {
    // A prefix test on this list would open /login-as-someone-else and
    // /signup-admin along with the real routes.
    expect(middleware).toContain("PUBLIC_EXACT.has(pathname)");
  });

  it("allows a public SUBTREE only for NextAuth's own handler", () => {
    /*
      There is one prefix match in the middleware, and it is deliberate:
      NextAuth needs /api/auth/* . Anything else added to that list would open a
      whole branch of the app, so the list is pinned here rather than the
      absence of prefix matching, which was the first (and wrong) thing this
      test asserted — it read the PUBLIC_PREFIXES check as if it applied to
      PUBLIC_EXACT and failed on correct code.
    */
    const block = middleware.match(/const PUBLIC_PREFIXES = \[([^\]]*)\]/);
    expect(block, "PUBLIC_PREFIXES not found").not.toBeNull();
    const prefixes = [...block![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(prefixes).toEqual(["/api/auth/"]);
  });
});
