import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { Role, type PrismaClient } from "@prisma/client";

/*
  "Continue with Google": sign-in, and a way to ask to join.

  - A Google account whose email matches an existing user signs that user in.
  - One that matches nobody asks to JOIN the home business (below) as a
    waiting STAFF member. They exist but are not approved: they see nothing and
    can do nothing until an owner approves them in Settings > Users and picks
    their role. Declining removes them.

  Nobody gets a business of their own through Google. Self-serve sign-up with
  email and password is where a new business is made.

  Why approval and not instant access: the sign-in page is public, and a Google
  account is free for anyone to make. Letting every Google sign-in straight into
  the business would hand its sales, invoices and costs to whoever found the URL.

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

export type GoogleUser = { id: string; role: Role; businessId: string; approved: boolean; created: boolean };

/**
 * The business Google sign-ins ask to join: GOOGLE_JOIN_BUSINESS_ID if it is set,
 * otherwise the oldest business, which is the one this app was set up for.
 */
export async function homeBusinessId(db: PrismaClient, configured: string | undefined = process.env.GOOGLE_JOIN_BUSINESS_ID): Promise<string | null> {
  if (configured) {
    const b = await db.business.findUnique({ where: { id: configured }, select: { id: true } });
    if (b) return b.id;
  }
  const first = await db.business.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  return first?.id ?? null;
}

const SELECT = { id: true, role: true, businessId: true, approved: true } as const;

export async function findOrCreateGoogleUser(
  db: PrismaClient,
  profile: { email: string; name?: string | null },
  homeId?: string | null,
): Promise<GoogleUser> {
  const existing = await db.user.findUnique({ where: { email: profile.email }, select: SELECT });
  if (existing) return { ...existing, created: false };

  const businessId = homeId === undefined ? await homeBusinessId(db) : homeId;
  if (!businessId) throw new Error("There is no business for Google sign-ins to join yet.");

  const name = (profile.name ?? "").trim() || profile.email.split("@")[0];
  const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);

  try {
    const user = await db.user.create({
      data: {
        businessId,
        email: profile.email,
        name: name.slice(0, 120),
        // The lowest role, and not approved: no location either, so nothing to see
        // even if some screen forgot to check.
        role: Role.STAFF,
        approved: false,
        passwordHash,
        mustChangePassword: false,
      },
      select: SELECT,
    });
    return { ...user, created: true };
  } catch (e) {
    // Two first sign-ins racing on the unique email: the other one won, use theirs.
    const again = await db.user.findUnique({ where: { email: profile.email }, select: SELECT });
    if (again) return { ...again, created: false };
    throw e;
  }
}
