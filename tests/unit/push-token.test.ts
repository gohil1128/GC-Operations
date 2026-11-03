import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mintDecisionToken, verifyDecisionToken } from "@/modules/push/token";
import { joinRequestPayload } from "@/modules/push/send";

let saved: string | undefined;
beforeEach(() => { saved = process.env.AUTH_SECRET; process.env.AUTH_SECRET = "test-secret-value-test-secret-value"; });
afterEach(() => { if (saved === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = saved; });

const NOW = 1_800_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

describe("the ticket in a notification", () => {
  it("carries one action on one person, issued to one owner", () => {
    const t = mintDecisionToken("approve", "u_target", "u_owner", NOW);
    expect(verifyDecisionToken(t, NOW + 1000)).toEqual({ action: "approve", targetUserId: "u_target", approverId: "u_owner" });
  });

  it("expires after three days", () => {
    const t = mintDecisionToken("decline", "u_target", "u_owner", NOW);
    expect(verifyDecisionToken(t, NOW + 2.9 * DAY)).not.toBeNull();
    expect(verifyDecisionToken(t, NOW + 3.1 * DAY)).toBeNull();
  });

  it("cannot be edited: a different action, person or owner fails", () => {
    const t = mintDecisionToken("decline", "u_target", "u_owner", NOW);
    const [body, sig] = t.split(".");
    const claims = JSON.parse(Buffer.from(body, "base64url").toString());
    for (const edit of [{ a: "approve" }, { t: "u_someone_else" }, { o: "u_me" }, { e: claims.e + 10 * DAY }]) {
      const forged = Buffer.from(JSON.stringify({ ...claims, ...edit })).toString("base64url");
      expect(verifyDecisionToken(`${forged}.${sig}`, NOW)).toBeNull();
    }
  });

  it("is rejected under another secret, and for anything malformed", () => {
    const t = mintDecisionToken("approve", "u_target", "u_owner", NOW);
    process.env.AUTH_SECRET = "a-different-secret-a-different-secret";
    expect(verifyDecisionToken(t, NOW)).toBeNull();
    for (const junk of [undefined, null, 42, "", "abc", "a.b", `${t}x`]) expect(verifyDecisionToken(junk as unknown, NOW)).toBeNull();
  });
});

describe("the notification an owner gets", () => {
  it("names the person, offers Approve and Decline, and carries a ticket for each", () => {
    const p = joinRequestPayload({ businessId: "b", userId: "u_target", name: "Wendy Waiting", email: "w@x.com" }, "u_owner", NOW);
    expect(p.title).toBe("Wendy Waiting wants to join");
    expect(p.body).toContain("w@x.com");
    expect(p.url).toBe("/settings/users");
    expect(p.actions.map((a) => a.action)).toEqual(["approve", "decline"]);
    expect(verifyDecisionToken(p.tokens.approve, NOW)).toMatchObject({ action: "approve", targetUserId: "u_target", approverId: "u_owner" });
    expect(verifyDecisionToken(p.tokens.decline, NOW)).toMatchObject({ action: "decline" });
  });
});
