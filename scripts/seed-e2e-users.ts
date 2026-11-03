import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

/*
  Deterministic accounts for the end-to-end suite.

  The suite used to fall back to whatever happened to exist. In CI that meant a
  staff account that only ever existed on one laptop: sign-in failed, Playwright
  waited out its 30s timeout, retried, and five failures tripped the app's own
  login rate limiter — which then locked the account for fifteen minutes and
  stranded every test after it. Six passed, twenty-three never ran, and the job
  burned 21 minutes finding that out.

  So the accounts are created here, explicitly, with passwords the workflow
  passes to the tests. Upserted rather than created, so re-running is safe.
*/

const prisma = new PrismaClient();

const ACCOUNTS = [
  { key: "OWNER", email: "e2e-owner@example.test", name: "E2E Owner", role: Role.OWNER },
  { key: "STAFF", email: "e2e-staff@example.test", name: "E2E Staff", role: Role.STAFF },
] as const;

async function main() {
  const password = process.env.E2E_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error("E2E_PASSWORD must be set to at least 12 characters");
  }
  const passwordHash = await bcrypt.hash(password, 10);

  const business = await prisma.business.findFirst({ select: { id: true, name: true } });
  if (!business) throw new Error("No business — run the main seed first");
  const locations = await prisma.location.findMany({
    where: { businessId: business.id },
    select: { id: true },
  });
  if (locations.length === 0) throw new Error("No locations — run the main seed first");

  for (const a of ACCOUNTS) {
    const user = await prisma.user.upsert({
      where: { email: a.email },
      update: {
        passwordHash,
        role: a.role,
        businessId: business.id,
        // Both matter: a temporary password would bounce every test to
        // /change-password, and a lockout left over from a previous run would
        // make the next one fail for reasons that have nothing to do with it.
        mustChangePassword: false,
      },
      create: {
        email: a.email,
        name: a.name,
        role: a.role,
        businessId: business.id,
        passwordHash,
        mustChangePassword: false,
      },
      select: { id: true, email: true, role: true },
    });

    // Membership of every location, or getScope() redirects them to /no-access.
    for (const loc of locations) {
      await prisma.userLocation.upsert({
        where: { userId_locationId: { userId: user.id, locationId: loc.id } },
        update: {},
        create: { userId: user.id, locationId: loc.id },
      });
    }
    console.log(`  ${user.role.padEnd(7)} ${user.email}`);
  }

  /*
    The section-lock tests need a PIN to exist — without one the lock controls
    are disabled and those tests cannot set up their own state. Set here so CI
    does not depend on somebody having configured it by hand.
  */
  const pin = process.env.E2E_SECTION_PIN;
  if (pin) {
    if (!/^\d{4}$/.test(pin)) throw new Error("E2E_SECTION_PIN must be exactly 4 digits");
    await prisma.business.update({
      where: { id: business.id },
      // Sections start unlocked; each test locks what it needs and puts it back.
      data: { sectionPinHash: await bcrypt.hash(pin, 10), lockedSections: [] },
    });
    console.log("  section PIN set, all sections unlocked");
  }

  // Clear any lockout so a previous run cannot poison this one.
  const cleared = await prisma.loginAttempt.deleteMany({});
  console.log(`cleared ${cleared.count} rate-limit rows`);

  console.log(`e2e accounts ready on "${business.name}" across ${locations.length} location(s)`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
