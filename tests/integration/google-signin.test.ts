import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { findOrCreateGoogleUser, homeBusinessId } from "@/modules/auth/google";

/*
  The Google sign-in's database side: an existing address is signed in as that
  user; an unknown one asks to join the home business as a waiting STAFF member
  with no access. Refuses to run against a database whose name does not contain
  "test".
*/
const url = process.env.DATABASE_URL ?? "";
const dbName = (() => { try { return decodeURIComponent(new URL(url).pathname.slice(1)); } catch { return ""; } })();
if (!/test/i.test(dbName)) throw new Error(`Refusing to run against database "${dbName}". Point DATABASE_URL at one whose name contains "test".`);

const db = new PrismaClient();
const tag = () => Math.random().toString(36).slice(2, 8);
const businesses: string[] = [];
const mkBusiness = async () => {
  const b = await db.business.create({ data: { name: `Test Biz ${tag()}` } });
  businesses.push(b.id);
  return b.id;
};
beforeAll(async () => { await db.$connect(); });
afterEach(async () => { for (const id of businesses.splice(0)) await db.business.delete({ where: { id } }); });

describe("findOrCreateGoogleUser", () => {
  it("makes an unknown address a waiting STAFF member of the home business, with no location", async () => {
    const home = await mkBusiness();
    const email = `new-${tag()}@test.invalid`;
    const u = await findOrCreateGoogleUser(db, { email, name: "Sam Rivera" }, home);
    expect(u).toMatchObject({ created: true, role: "STAFF", approved: false, businessId: home });
    expect(await db.userLocation.count({ where: { userId: u.id } })).toBe(0);
    // And no business of their own was made for them.
    expect(await db.business.count({ where: { id: { not: home }, users: { some: { email } } } })).toBe(0);
  });

  it("gives the waiting user a password nobody knows", async () => {
    const home = await mkBusiness();
    const email = `nopw-${tag()}@test.invalid`;
    const u = await findOrCreateGoogleUser(db, { email, name: "No Pw" }, home);
    const row = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(row.passwordHash).toMatch(/^\$2[aby]\$/);
    for (const guess of ["", "password", "12345678", email]) expect(await bcrypt.compare(guess, row.passwordHash)).toBe(false);
  });

  it("signs an existing, approved user in as themselves and creates nothing", async () => {
    const home = await mkBusiness();
    const email = `old-${tag()}@test.invalid`;
    const owner = await db.user.create({ data: { businessId: home, email, name: "Old Hand", role: "OWNER", passwordHash: "x" } });
    const before = await db.user.count();
    const again = await findOrCreateGoogleUser(db, { email, name: "Someone Else Entirely" }, home);
    expect(again).toMatchObject({ id: owner.id, role: "OWNER", approved: true, created: false });
    expect(await db.user.count()).toBe(before);
  });

  it("an address that is already waiting stays waiting", async () => {
    const home = await mkBusiness();
    const email = `wait-${tag()}@test.invalid`;
    const first = await findOrCreateGoogleUser(db, { email, name: "W" }, home);
    const second = await findOrCreateGoogleUser(db, { email, name: "W" }, home);
    expect(second).toMatchObject({ id: first.id, approved: false, created: false });
  });

  it("two first sign-ins at once make one request", async () => {
    const home = await mkBusiness();
    const email = `race-${tag()}@test.invalid`;
    const [x, y] = await Promise.all([
      findOrCreateGoogleUser(db, { email, name: "Race" }, home),
      findOrCreateGoogleUser(db, { email, name: "Race" }, home),
    ]);
    expect(x.id).toBe(y.id);
    expect(await db.user.count({ where: { email } })).toBe(1);
  });
});

describe("homeBusinessId", () => {
  it("uses the configured business, and falls back to the oldest", async () => {
    const a = await mkBusiness();
    const b = await mkBusiness();
    expect(await homeBusinessId(db, b)).toBe(b);
    // An id that does not exist is ignored rather than trusted.
    const fallback = await homeBusinessId(db, "no-such-business");
    const oldest = await db.business.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
    expect(fallback).toBe(oldest.id);
    expect([a, b]).toContain(b);
  });
});
