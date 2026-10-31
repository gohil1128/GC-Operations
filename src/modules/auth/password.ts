import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";

/* Everything about setting a password, in one place. */

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(200, "That is longer than any password needs to be");

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

// Friendly 12 characters, with the shapes that get misread out loud or written
// down by hand removed: no 0/O, no l/1/I.
const SAFE_CHARS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generatePassword(length = 12): string {
  // rejection-sampled so the modulo does not quietly favour the front of the
  // alphabet the way `% SAFE_CHARS.length` on a raw byte would
  const limit = 256 - (256 % SAFE_CHARS.length);
  let out = "";
  while (out.length < length) {
    for (const byte of randomBytes(length)) {
      if (byte >= limit) continue;
      out += SAFE_CHARS[byte % SAFE_CHARS.length];
      if (out.length === length) break;
    }
  }
  return out;
}

/* ── Reset tokens ──────────────────────────────────────────────────────────
   The token is 256 bits of randomness, so only its SHA-256 is stored: read
   access to the table must not be enough to take an account, and unlike a
   password there is no need for a slow hash — there is nothing to guess.
*/

const TOKEN_TTL_MINUTES = 60;

function digest(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

/** Issues a token, invalidating any earlier one for that person. */
export async function createResetToken(userId: string) {
  const raw = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000);
  await prisma.$transaction([
    // One live link at a time: a second "forgot password" must not leave the
    // first email still working.
    prisma.passwordResetToken.deleteMany({ where: { userId, usedAt: null } }),
    prisma.passwordResetToken.create({ data: { userId, tokenHash: digest(raw), expiresAt } }),
  ]);
  return { token: raw, expiresAt };
}

export type ResetTokenCheck =
  | { ok: true; userId: string; name: string; email: string }
  | { ok: false; reason: "invalid" | "expired" | "used" };

export async function checkResetToken(raw: string): Promise<ResetTokenCheck> {
  if (!raw) return { ok: false, reason: "invalid" };
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: digest(raw) },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!row) return { ok: false, reason: "invalid" };
  if (row.usedAt) return { ok: false, reason: "used" };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };
  return { ok: true, userId: row.user.id, name: row.user.name, email: row.user.email };
}

/**
 * Spends the token and sets the password in one transaction. The update is
 * conditional on the token still being unused, so two submissions of the same
 * link cannot both win.
 */
export async function consumeResetToken(raw: string, newPassword: string): Promise<boolean> {
  const check = await checkResetToken(raw);
  if (!check.ok) return false;
  const passwordHash = await hashPassword(newPassword);

  try {
    await prisma.$transaction(async (tx) => {
      const spent = await tx.passwordResetToken.updateMany({
        where: { tokenHash: digest(raw), usedAt: null },
        data: { usedAt: new Date() },
      });
      if (spent.count !== 1) throw new Error("ALREADY_USED");
      await tx.user.update({
        where: { id: check.userId },
        data: { passwordHash, mustChangePassword: false },
      });
      // Any other outstanding link for this person dies with the change.
      await tx.passwordResetToken.deleteMany({ where: { userId: check.userId, usedAt: null } });
    });
  } catch {
    return false;
  }
  return true;
}

/** Constant-time compare, for anywhere a secret is checked outside bcrypt. */
export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
