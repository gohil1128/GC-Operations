import { describe, expect, it } from "vitest";
import { businessNameFor, validTimezone, verifiedEmail } from "@/modules/auth/google";

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

describe("businessNameFor", () => {
  it("starts from the first name, then the address", () => {
    expect(businessNameFor("Harsh Raj Gohil", "h@x.com")).toBe("Harsh's business");
    expect(businessNameFor("", "chai.stall@x.com")).toBe("chai.stall's business");
    expect(businessNameFor(null, "@x.com")).toBe("My's business");
  });
});

describe("validTimezone", () => {
  it("accepts real zones and rejects junk", () => {
    expect(validTimezone("America/Toronto")).toBe(true);
    expect(validTimezone("Mars/Olympus")).toBe(false);
    expect(validTimezone("")).toBe(false);
    expect(validTimezone(null)).toBe(false);
  });
});
