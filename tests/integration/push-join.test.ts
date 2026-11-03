import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { notifyJoinRequest, type Sender } from "@/modules/push/send";
import { applyPushDecision } from "@/modules/push/decision";
import { mintDecisionToken } from "@/modules/push/token";

/*
  The notification path against a real database: who is told, what happens to a
  dead subscription, and what the Approve / Decline tickets can and cannot do.
  Refuses to run against a database whose name does not contain "test".
*/
const url = process.env.DATABASE_URL ?? "";
const dbName = (() => { try { return decodeURIComponent(new URL(url).pathname.slice(1)); } catch { return ""; } })();
if (!/test/i.test(dbName)) throw new Error(`Refusing to run against database "${dbName}". Point DATABASE_URL at one whose name contains "test".`);
process.env.AUTH_SECRET ??= "test-secret-value-test-secret-value";

const db = new PrismaClient();
const tag = () => Math.random().toString(36).slice(2, 8);
let biz: string, other: string, owner: string, manager: string, waiting: string, loc: string;
const businesses: string[] = [];

beforeAll(async () => { await db.$connect(); });
beforeEach(async () => {
  const mk = async () => { const b = await db.business.create({ data: { name: `Test ${tag()}` } }); businesses.push(b.id); return b.id; };
  biz = await mk(); other = await mk();
  loc = (await db.location.create({ data: { businessId: biz, name: "Stall" } })).id;
  owner = (await db.user.create({ data: { businessId: biz, email: `o-${tag()}@t.invalid`, name: "Owner", role: "OWNER", passwordHash: "x" } })).id;
  manager = (await db.user.create({ data: { businessId: biz, email: `m-${tag()}@t.invalid`, name: "Mgr", role: "MANAGER", passwordHash: "x" } })).id;
  waiting = (await db.user.create({ data: { businessId: biz, email: `w-${tag()}@t.invalid`, name: "Wendy", role: "STAFF", approved: false, passwordHash: "x" } })).id;
});
afterEach(async () => { for (const id of businesses.splice(0)) await db.business.delete({ where: { id } }); });

const sub = (userId: string, n: string) => db.pushSubscription.create({ data: { userId, endpoint: `https://push.test/${n}-${tag()}`, p256dh: "p", auth: "a" } });
const info = () => ({ businessId: biz, userId: waiting, name: "Wendy", email: "w@t.invalid" });

describe("notifyJoinRequest", () => {
  it("tells owners who have it on, and nobody else", async () => {
    await sub(owner, "owner"); await sub(manager, "manager");
    const got: string[] = [];
    const send: Sender = async (t) => { got.push(t.endpoint); };
    expect(await notifyJoinRequest(db, info(), send)).toBe(1);
    expect(got).toHaveLength(1);
    expect(got[0]).toContain("owner");
  });

  it("does not tell an owner of a different business", async () => {
    const stranger = (await db.user.create({ data: { businessId: other, email: `s-${tag()}@t.invalid`, name: "S", role: "OWNER", passwordHash: "x" } })).id;
    await sub(stranger, "stranger");
    expect(await notifyJoinRequest(db, info(), async () => {})).toBe(0);
  });

  it("forgets a subscription the push service says is gone, and survives other failures", async () => {
    const gone = await sub(owner, "gone");
    const flaky = await sub(owner, "flaky");
    const send: Sender = async (t) => {
      if (t.endpoint === gone.endpoint) throw Object.assign(new Error("gone"), { statusCode: 410 });
      throw new Error("push service down");
    };
    expect(await notifyJoinRequest(db, info(), send)).toBe(0);
    expect(await db.pushSubscription.findUnique({ where: { id: gone.id } })).toBeNull();
    expect(await db.pushSubscription.findUnique({ where: { id: flaky.id } })).not.toBeNull();
  });
});

describe("applyPushDecision", () => {
  it("Approve from a notification makes them Staff at every location", async () => {
    const r = await applyPushDecision(db, mintDecisionToken("approve", waiting, owner));
    expect(r).toMatchObject({ ok: true });
    const u = await db.user.findUniqueOrThrow({ where: { id: waiting } });
    expect(u).toMatchObject({ approved: true, role: "STAFF" });
    expect(await db.userLocation.count({ where: { userId: waiting, locationId: loc } })).toBe(1);
    expect(await db.auditLog.count({ where: { userId: owner, action: "user.approve", entityId: waiting } })).toBe(1);
  });

  it("Decline removes the request", async () => {
    expect(await applyPushDecision(db, mintDecisionToken("decline", waiting, owner))).toMatchObject({ ok: true });
    expect(await db.user.findUnique({ where: { id: waiting } })).toBeNull();
  });

  it("a second tap does nothing and says so", async () => {
    const t = mintDecisionToken("approve", waiting, owner);
    await applyPushDecision(db, t);
    expect(await applyPushDecision(db, t)).toMatchObject({ ok: false });
  });

  it("only an approved OWNER's ticket works", async () => {
    expect(await applyPushDecision(db, mintDecisionToken("approve", waiting, manager))).toMatchObject({ ok: false });
    expect((await db.user.findUniqueOrThrow({ where: { id: waiting } })).approved).toBe(false);
  });

  it("cannot reach a person in another business, or someone already approved", async () => {
    const foreign = (await db.user.create({ data: { businessId: other, email: `f-${tag()}@t.invalid`, name: "F", role: "STAFF", approved: false, passwordHash: "x" } })).id;
    expect(await applyPushDecision(db, mintDecisionToken("decline", foreign, owner))).toMatchObject({ ok: false });
    expect(await db.user.findUnique({ where: { id: foreign } })).not.toBeNull();
    expect(await applyPushDecision(db, mintDecisionToken("decline", manager, owner))).toMatchObject({ ok: false });
    expect(await db.user.findUnique({ where: { id: manager } })).not.toBeNull();
  });

  it("rejects an expired or forged ticket", async () => {
    const old = mintDecisionToken("approve", waiting, owner, Date.now() - 10 * 24 * 3600 * 1000);
    expect(await applyPushDecision(db, old)).toMatchObject({ ok: false });
    expect(await applyPushDecision(db, "nonsense")).toMatchObject({ ok: false });
  });
});
