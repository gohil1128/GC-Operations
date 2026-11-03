import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { LocationKind, Role, type PrismaClient } from "@prisma/client";

/*
  "Continue with Google": sign-up and sign-in in one.

  A Google account that matches an existing user signs that user in. One that
  matches nobody creates a new business with that person as its owner, exactly
  as the sign-up page does (a Business, its first Location, an OWNER, and the
  owner's membership of the location, all or none).

  THE EMAIL MUST BE VERIFIED BY GOOGLE. Signing in as whoever owns an address is
  only safe if somebody has proved they own it; without the check, anyone could
  register a Google identity under another person's address and be handed that
  person's account.

  A Google user has no password. The column is required, so they get a hash of
  a random value nobody was ever told: password sign-in cannot succeed for them,
  and "Forgot password" still works if they later want one.
*/

export type GoogleProfile = {
  email?: string | null;
  email_verified?: boolean | null;
  name?: string | null;
};

/** The profile's email, lower-cased, or null if Google has not verified it. */
export function verifiedEmail(p: GoogleProfile | null | undefined): string | null {
  const email = p?.email?.trim().toLowerCase();
  if (!email || p?.email_verified !== true) return null;
  return email;
}

/** A starting business name from what Google tells us. It is editable in settings. */
export function businessNameFor(name: string | null | undefined, email: string): string {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  const base = first || email.split("@")[0] || "My";
  return `${base.slice(0, 60)}'s business`;
}

/** Whether a string is an IANA timezone this runtime knows. */
export function validTimezone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export type GoogleUser = { id: string; role: Role; businessId: string; created: boolean };

export async function findOrCreateGoogleUser(
  db: PrismaClient,
  profile: { email: string; name?: string | null },
  timezone: string | null,
): Promise<GoogleUser> {
  const existing = await db.user.findUnique({
    where: { email: profile.email },
    select: { id: true, role: true, businessId: true },
  });
  if (existing) return { ...existing, created: false };

  const name = (profile.name ?? "").trim() || profile.email.split("@")[0];
  const businessName = businessNameFor(profile.name, profile.email);
  const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);

  try {
    const made = await db.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: { name: businessName, ...(validTimezone(timezone) ? { timezone } : {}) },
      });
      const location = await tx.location.create({
        data: { businessId: business.id, name: businessName, kind: LocationKind.EVENT },
      });
      const user = await tx.user.create({
        data: { businessId: business.id, email: profile.email, name: name.slice(0, 120), role: Role.OWNER, passwordHash, mustChangePassword: false },
      });
      await tx.userLocation.create({ data: { userId: user.id, locationId: location.id } });
      return { id: user.id, role: user.role, businessId: business.id };
    });
    return { ...made, created: true };
  } catch (e) {
    // Two first sign-ins racing on the unique email: the other one won, use theirs.
    const again = await db.user.findUnique({ where: { email: profile.email }, select: { id: true, role: true, businessId: true } });
    if (again) return { ...again, created: false };
    throw e;
  }
}
