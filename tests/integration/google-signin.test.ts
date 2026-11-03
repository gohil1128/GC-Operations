import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { findOrCreateGoogleUser } from "@/modules/auth/google";

/*
  The Google sign-in's database side: an existing address is signed in as that
  user, an unknown one gets a whole new business, and nothing is half-made.
  Refuses to run against a database whose name does not contain "test".
*/
const url = process.env.DATABASE_URL ?? "";
const dbName = (() => { try { return decodeURIComponent(new URL(url).pathname.slice(1)); } catch { return ""; } })();
if (!/test/i.test(dbName)) throw new Error(`Refusing to run against database "${dbName}". Point DATABASE_URL at one whose name contains "test".`);

const db = new PrismaClient();
const made: string[] = [];
const tag = () => Math.random().toString(36).slice(2, 8);
beforeAll(async () => { await db.$connect(); });
afterEach(async () => {
  for (const businessId of made.splice(0)) await db.business.delete({ where: { id: businessId } });
});

describe("findOrCreateGoogleUser", () => {
  it("creates a business, a location, an owner and the membership for a new address", async () => {
    const email = `new-${tag()}@test.invalid`;
    const u = await findOrCreateGoogleUser(db, { email, name: "Sam Rivera" }, "America/Toronto");
    made.push(u.businessId);
    expect(u).toMatchObject({ created: true, role: "OWNER" });

    const biz = await db.business.findUniqueOrThrow({ where: { id: u.businessId }, include: { locations: true } });
    expect(biz.name).toBe("Sam's business");
    expect(biz.timezone).toBe("America/Toronto");
    expect(biz.locations).toHaveLength(1);
    expect(await db.userLocation.count({ where: { userId: u.id, locationId: biz.locations[0].id } })).toBe(1);
  });

  it("gives the new user a password nobody knows", async () => {
    const email = `nopw-${tag()}@test.invalid`;
    const u = await findOrCreateGoogleUser(db, { email, name: "No Pw" }, null);
    made.push(u.businessId);
    const row = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(row.passwordHash).toMatch(/^\$2[aby]\$/);
    for (const guess of ["", "password", "12345678", email]) expect(await bcrypt.compare(guess, row.passwordHash)).toBe(false);
    expect(row.mustChangePassword).toBe(false);
  });

  it("signs an existing user in as themselves and creates nothing", async () => {
    const email = `old-${tag()}@test.invalid`;
    const first = await findOrCreateGoogleUser(db, { email, name: "Old Hand" }, null);
    made.push(first.businessId);
    const before = await db.business.count();
    const again = await findOrCreateGoogleUser(db, { email, name: "Someone Else Entirely" }, "Asia/Tokyo");
    expect(again).toMatchObject({ id: first.id, businessId: first.businessId, created: false });
    expect(await db.business.count()).toBe(before);
  });

  it("falls back to the default timezone for a missing or invalid one", async () => {
    const a = await findOrCreateGoogleUser(db, { email: `tz1-${tag()}@test.invalid`, name: "A" }, "Not/AZone");
    made.push(a.businessId);
    const biz = await db.business.findUniqueOrThrow({ where: { id: a.businessId } });
    expect(biz.timezone).toBe("America/New_York");
  });

  it("two first sign-ins at once make one account", async () => {
    const email = `race-${tag()}@test.invalid`;
    const [x, y] = await Promise.all([
      findOrCreateGoogleUser(db, { email, name: "Race" }, null),
      findOrCreateGoogleUser(db, { email, name: "Race" }, null),
    ]);
    made.push(x.businessId);
    expect(x.id).toBe(y.id);
    expect(await db.user.count({ where: { email } })).toBe(1);
  });
});
