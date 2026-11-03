"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getScope } from "@/lib/scope";
import { requireUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import {
  checkSectionPinAllowed,
  recordSectionPinFailure,
  clearSectionPinFailures,
} from "@/modules/auth/rate-limit";
import { SECTION_KEYS, UNLOCK_TTL_MINUTES, type SectionKey } from "./sections";
import { mintUnlockToken, unlockTokenIsValid } from "./unlock-token";

/*
  Section lock — personal and optional.

  Everything is open by default, for everyone. A person who wants Profit & loss,
  Events or Recipes hidden on their own screen can set a 4-digit PIN of their
  own and choose which sections it guards. It affects only them: an owner's PIN
  does not close anything for a manager, and vice versa.

  Unlocking opens all of that person's locked sections for an hour, because a
  PIN per section is three PINs nobody remembers.

  History: this was one PIN for the whole business, set by the owner, which put
  P&L and Reports behind a PIN for every staff member whether or not they
  wanted one. The business-level columns are retired (see the migration).

  Every function here takes the USER'S id where it used to take the business's:
  the PIN, the list and the unlock cookie are all per person.
*/

const UNLOCKED_COOKIE = "sections-unlocked";

const pinSchema = z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits");

/**
 * True while this person has a genuine, unexpired unlock. The signed cookie is
 * bound to their user id, so it cannot open anything for anyone else.
 *
 * The cookie is a signed token now. It used to be the raw timestamp, which
 * anyone could set by hand to open every locked section — see unlock-token.ts.
 */
async function unlockIsFresh(userId: string): Promise<boolean> {
  const cookieStore = await cookies();
  return unlockTokenIsValid(
    cookieStore.get(UNLOCKED_COOKIE)?.value,
    userId,
    UNLOCK_TTL_MINUTES,
    Date.now(),
  );
}

/**
 * Set or change MY PIN. A first PIN also puts Profit & loss behind it, because
 * that is what people who add one want; they can change the list afterwards.
 */
export async function setSectionPinAction(formData: FormData) {
  const user = await requireUser();
  const scope = await getScope();
  const pin = pinSchema.parse(formData.get("pin"));
  const hash = await bcrypt.hash(pin, 10);
  const me = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { sectionPinHash: true, lockedSections: true } });
  await prisma.user.update({
    where: { id: user.id },
    data: {
      sectionPinHash: hash,
      ...(me.sectionPinHash || me.lockedSections.length > 0 ? {} : { lockedSections: ["REPORTS"] }),
    },
  });
  // Setting a PIN should lock, not leave the setter unlocked by accident.
  (await cookies()).delete(UNLOCKED_COOKIE);
  await writeAudit({
    businessId: scope.businessId, userId: user.id,
    action: me.sectionPinHash ? "sections.pin.change" : "sections.pin.set", entityType: "User", entityId: user.id,
  });
  revalidatePath("/", "layout");
}

/** Remove MY PIN: everything is open for me again. */
export async function removeSectionPinAction() {
  const user = await requireUser();
  const scope = await getScope();
  // Clearing the list too: a PIN-less person with sections still marked locked
  // would see lock badges that guard nothing.
  await prisma.user.update({ where: { id: user.id }, data: { sectionPinHash: null, lockedSections: [] } });
  (await cookies()).delete(UNLOCKED_COOKIE);
  await writeAudit({
    businessId: scope.businessId, userId: user.id,
    action: "sections.pin.remove", entityType: "User", entityId: user.id,
  });
  revalidatePath("/", "layout");
}

/** Choose which sections MY PIN guards. */
export async function setLockedSectionsAction(sections: string[]) {
  const user = await requireUser();
  const scope = await getScope();
  const clean = [...new Set(sections)].filter((s) => SECTION_KEYS.includes(s));
  const me = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { sectionPinHash: true } });
  if (!me.sectionPinHash) throw new Error("Set a PIN first.");
  await prisma.user.update({ where: { id: user.id }, data: { lockedSections: clean } });
  await writeAudit({
    businessId: scope.businessId, userId: user.id,
    action: "sections.locked.set", entityType: "User", entityId: user.id,
    diff: { lockedSections: clean },
  });
  revalidatePath("/", "layout");
}

/*
  Keys for throttling PIN guesses.

  Deliberately NOT the login buckets. Sharing them would let anyone who wanted a
  colleague locked out of signing in simply mistype the section PIN five times.
  These are their own namespace, counted per user and per business: the per-user
  key stops one account grinding through the space, the per-business key stops
  the same grind spread across several accounts.
*/
function sectionPinKeys(businessId: string, userId: string): string[] {
  return [`sectionpin:user:${userId}`, `sectionpin:business:${businessId}`];
}

export async function unlockSectionsAction(formData: FormData) {
  const scope = await getScope();
  const pinRaw = String(formData.get("pin") ?? "");
  const me = await prisma.user.findUnique({
    where: { id: scope.userId },
    select: { sectionPinHash: true },
  });
  if (!me?.sectionPinHash) return { ok: true as const };

  /*
    The PIN is four digits — ten thousand possibilities. Without a limit it
    could be ground through in minutes while signed in as that person, and
    because only the success path was audited, nobody would see it happen.
  */
  const keys = sectionPinKeys(scope.businessId, scope.userId);
  const limit = await checkSectionPinAllowed(keys);
  if (limit.locked) {
    return {
      error: `Too many incorrect PINs. Try again in ${Math.ceil(limit.retryAfterSec / 60)} minute${
        limit.retryAfterSec > 60 ? "s" : ""
      }.`,
    };
  }

  const ok = await bcrypt.compare(pinRaw, me.sectionPinHash);
  if (!ok) {
    await recordSectionPinFailure(keys);
    // Failures are audited too, not just unlocks: a run of these is the signal
    // that someone is guessing.
    await writeAudit({
      businessId: scope.businessId, userId: scope.userId,
      action: "sections.unlock.failed", entityType: "User", entityId: scope.userId,
    });
    return { error: "Incorrect PIN" };
  }

  await clearSectionPinFailures(keys);

  (await cookies()).set(UNLOCKED_COOKIE, mintUnlockToken(scope.userId, Date.now()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * UNLOCK_TTL_MINUTES,
    path: "/",
  });
  await writeAudit({
    businessId: scope.businessId, userId: scope.userId,
    action: "sections.unlock", entityType: "User", entityId: scope.userId,
  });
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Re-lock everything immediately, without waiting out the hour. */
export async function lockSectionsAction() {
  (await cookies()).delete(UNLOCKED_COOKIE);
  revalidatePath("/", "layout");
}

type Mine = { sectionPinHash: string | null; lockedSections: string[] };
const mine = (userId: string): Promise<Mine | null> =>
  prisma.user.findUnique({ where: { id: userId }, select: { sectionPinHash: true, lockedSections: true } });

/** Is this one section closed to this person right now? Open unless THEY chose to lock it. */
export async function isSectionLocked(userId: string, section: SectionKey): Promise<boolean> {
  const me = await mine(userId);
  if (!me?.sectionPinHash) return false;
  if (!me.lockedSections.includes(section)) return false;
  return !(await unlockIsFresh(userId));
}

/** Every section currently closed for this person — one query, for the nav's lock badges. */
export async function lockedSectionsNow(userId: string): Promise<SectionKey[]> {
  const me = await mine(userId);
  if (!me?.sectionPinHash) return [];
  if (await unlockIsFresh(userId)) return [];
  return me.lockedSections.filter((s): s is SectionKey => SECTION_KEYS.includes(s));
}

/**
 * Is this section open right now *only* because this person entered their PIN?
 * Distinct from "not locked": a section they never locked is open for good and
 * has nothing to re-lock. This decides whether it shows a "Lock" control.
 */
export async function isSectionUnlockedByPin(userId: string, section: SectionKey): Promise<boolean> {
  const me = await mine(userId);
  if (!me?.sectionPinHash) return false;
  if (!me.lockedSections.includes(section)) return false;
  return await unlockIsFresh(userId);
}

/** What the settings card and the quick-lock icon need: whether I have a PIN, and what it guards. */
export async function sectionLockSettings(userId: string) {
  const me = await mine(userId);
  return {
    hasPin: !!me?.sectionPinHash,
    locked: (me?.lockedSections ?? []).filter((s): s is SectionKey => SECTION_KEYS.includes(s)),
  };
}

/** One tap from the little lock icon: put Profit & loss (or another section) behind my existing PIN. */
export async function lockSectionWithMyPinAction(section: string) {
  const user = await requireUser();
  const scope = await getScope();
  if (!SECTION_KEYS.includes(section)) throw new Error("Unknown section.");
  const me = await mine(user.id);
  if (!me?.sectionPinHash) throw new Error("Set a PIN first.");
  const next = [...new Set([...me.lockedSections, section])];
  await prisma.user.update({ where: { id: user.id }, data: { lockedSections: next } });
  // Locking should lock now, not leave this session open for the rest of the hour.
  (await cookies()).delete(UNLOCKED_COOKIE);
  await writeAudit({
    businessId: scope.businessId, userId: user.id,
    action: "sections.locked.set", entityType: "User", entityId: user.id, diff: { lockedSections: next },
  });
  revalidatePath("/", "layout");
}
