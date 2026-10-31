"use server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { hashPassword, passwordSchema } from "@/modules/auth/password";

/*
  Changing your own password — the thing that makes an account actually belong
  to the person using it. Before this, a password was issued by the owner and
  could never be replaced by the person it was handed to.

  Errors are returned rather than thrown: Next.js strips the message off a
  thrown Error in a production build, so a thrown "that is not your current
  password" reaches the browser as an unreadable digest.
*/

const schema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "The two new passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: "That is the password you already have — pick a different one",
    path: ["newPassword"],
  });

export async function changeOwnPasswordAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();

  const parsed = schema.safeParse({
    currentPassword: String(formData.get("currentPassword") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };

  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!row) return { error: "Your account no longer exists. Sign in again." };

  // Proves it is the account holder at the keyboard and not a borrowed session.
  const ok = await bcrypt.compare(parsed.data.currentPassword, row.passwordHash);
  if (!ok) return { error: "That is not your current password." };

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    }),
    // Any reset link outstanding for this person stops working now that they
    // have demonstrably got back in on their own.
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
  ]);

  await writeAudit({
    businessId: user.businessId,
    userId: user.id,
    action: "user.password_change",
    entityType: "User",
    entityId: user.id,
  });

  return { ok: true };
}
