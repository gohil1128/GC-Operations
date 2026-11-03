import { describe, it, expect, beforeAll } from "vitest";
import { mintUnlockToken, unlockTokenIsValid } from "@/modules/section-lock/unlock-token";

/*
  The section-unlock cookie.

  Before this was signed, the cookie was the raw timestamp: setting
  `sections-unlocked=<epoch millis>` in devtools opened every locked section.
  Proved against a running build — a MANAGER went from 403 to a full costed
  recipe export on /api/exports/recipes without ever knowing the PIN.
*/

const BIZ = "biz_abc123";
const OTHER = "biz_xyz789";
const TTL = 60;
const NOW = 1_800_000_000_000;

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-for-unlock-token";
});

describe("a genuine token", () => {
  it("validates for the business it was minted for", () => {
    expect(unlockTokenIsValid(mintUnlockToken(BIZ, NOW), BIZ, TTL, NOW)).toBe(true);
  });

  it("stays valid inside the window", () => {
    const t = mintUnlockToken(BIZ, NOW);
    expect(unlockTokenIsValid(t, BIZ, TTL, NOW + 59 * 60_000)).toBe(true);
  });

  it("expires at the end of the window", () => {
    const t = mintUnlockToken(BIZ, NOW);
    expect(unlockTokenIsValid(t, BIZ, TTL, NOW + 61 * 60_000)).toBe(false);
  });
});

describe("forgery", () => {
  it("rejects a bare timestamp — the exact bypass that shipped", () => {
    expect(unlockTokenIsValid(String(NOW), BIZ, TTL, NOW)).toBe(false);
  });

  it("rejects a timestamp with a made-up signature", () => {
    expect(unlockTokenIsValid(`${NOW}.deadbeef`, BIZ, TTL, NOW)).toBe(false);
    expect(unlockTokenIsValid(`${NOW}.${"0".repeat(64)}`, BIZ, TTL, NOW)).toBe(false);
  });

  it("rejects a token signed for another business", () => {
    expect(unlockTokenIsValid(mintUnlockToken(OTHER, NOW), BIZ, TTL, NOW)).toBe(false);
  });

  it("rejects a token whose timestamp has been edited to extend it", () => {
    const t = mintUnlockToken(BIZ, NOW);
    const sig = t.slice(t.lastIndexOf(".") + 1);
    // Same signature, later claim — the signature covers the timestamp, so this dies.
    expect(unlockTokenIsValid(`${NOW + 50 * 60_000}.${sig}`, BIZ, TTL, NOW + 50 * 60_000)).toBe(false);
  });

  it("rejects a token dated in the future", () => {
    expect(unlockTokenIsValid(mintUnlockToken(BIZ, NOW + 60_000), BIZ, TTL, NOW)).toBe(false);
  });

  it("rejects a token minted with a different secret", () => {
    const t = mintUnlockToken(BIZ, NOW);
    process.env.AUTH_SECRET = "a-different-secret";
    expect(unlockTokenIsValid(t, BIZ, TTL, NOW)).toBe(false);
    process.env.AUTH_SECRET = "test-secret-for-unlock-token";
  });
});

describe("malformed input re-locks rather than throwing", () => {
  it("handles junk", () => {
    for (const bad of [undefined, "", ".", "..", "abc", "abc.def", `.${"a".repeat(64)}`,
                       "NaN.abc", "Infinity.abc", `${NOW}.`]) {
      expect(() => unlockTokenIsValid(bad as any, BIZ, TTL, NOW)).not.toThrow();
      expect(unlockTokenIsValid(bad as any, BIZ, TTL, NOW)).toBe(false);
    }
  });
});

describe("the secret is mandatory", () => {
  it("refuses to mint without one, rather than signing with a default", () => {
    const saved = process.env.AUTH_SECRET;
    const savedNext = process.env.NEXTAUTH_SECRET;
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    expect(() => mintUnlockToken(BIZ, NOW)).toThrow(/AUTH_SECRET/);
    process.env.AUTH_SECRET = saved;
    if (savedNext) process.env.NEXTAUTH_SECRET = savedNext;
  });
});
