import { describe, expect, it } from "vitest";
import { verifiedEmail } from "@/modules/auth/google";

describe("verifiedEmail", () => {
  it("returns the lower-cased address only when Google has verified it", () => {
    expect(verifiedEmail({ email: " Sam@Example.COM ", email_verified: true })).toBe("sam@example.com");
  });
  it("refuses an unverified, missing, or loosely-typed verification", () => {
    expect(verifiedEmail({ email: "a@b.co", email_verified: false })).toBeNull();
    expect(verifiedEmail({ email: "a@b.co" })).toBeNull();
    expect(verifiedEmail({ email: "a@b.co", email_verified: "true" as unknown as boolean })).toBeNull();
    expect(verifiedEmail({ email_verified: true })).toBeNull();
    expect(verifiedEmail(null)).toBeNull();
  });
});
