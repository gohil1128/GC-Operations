/*
  Break-glass password reset, run against the database directly.

  The in-app reset (Settings → Team) generates a password and shows it exactly
  once, and it requires an OWNER session — so if the only owner's password is
  lost, there is no way back in through the UI. A manager cannot reset it, and
  a fresh reset cannot be requested without being signed in.

  This is the way back. It runs nowhere near the app: point DATABASE_URL at the
  database, give it an address and a password you choose, and it writes the
  hash. It also clears any lockout on that address so you are not left waiting
  out a rate-limit window you tripped while trying to get in.

  Usage:
    DATABASE_URL=... pnpm tsx scripts/set-password.ts owner@example.com

  It reads the password from a prompt rather than the command line, so the
  secret does not end up in shell history or the process list.
*/
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: pnpm tsx scripts/set-password.ts <email>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!user) {
    // Listing the addresses is fine here: whoever can run this already has the
    // database, and a typo'd address is the most likely reason to land here.
    const all = await prisma.user.findMany({ select: { email: true, role: true }, orderBy: { email: "asc" } });
    console.error(`No user with address "${email}". This database has:`);
    for (const u of all) console.error(`  ${u.email}  (${u.role})`);
    process.exit(1);
  }

  const rl = createInterface({ input: stdin, output: stdout });
  const password = (await rl.question(`New password for ${user.email} (${user.role}): `)).trim();
  rl.close();

  // Matches the sign-in form's own rule, so this cannot write a password the
  // login page would then refuse to submit.
  if (password.length < 6) {
    console.error("Password must be at least 6 characters.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  // Clear any lockout for this address so the next attempt is not refused.
  const cleared = await prisma.loginAttempt.deleteMany({ where: { key: `email:${email}` } });

  console.log(`\nPassword set for ${user.email}.`);
  if (cleared.count > 0) console.log("Cleared the rate-limit lockout on that address.");
  console.log("Sign in with it now — nothing else needs restarting or redeploying.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
