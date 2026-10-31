"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getScope } from "@/lib/scope";
import { requireOwner } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { createResetToken, generatePassword, hashPassword } from "@/modules/auth/password";

const inviteSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  role: z.enum(["OWNER", "MANAGER", "STAFF"]),
});

export async function inviteUserAction(formData: FormData): Promise<{ ok: true; email: string; password: string } | { error: string }> {
  await requireOwner();
  const scope = await getScope();
  const parsed = inviteSchema.safeParse({
    name: formData.get("name"),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return { error: "A user with that email already exists." };

  const password = generatePassword();
  const passwordHash = await hashPassword(password);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        businessId: scope.businessId,
        name: parsed.data.name,
        email: parsed.data.email,
        role: parsed.data.role,
        passwordHash,
        // Handed over by somebody else, so it gets them in exactly once: the
        // app refuses to load anything until they have chosen their own.
        mustChangePassword: true,
      },
    });
    // Give the new user access to every location in the business
    const locations = await tx.location.findMany({ where: { businessId: scope.businessId }, select: { id: true } });
    if (locations.length > 0) {
      await tx.userLocation.createMany({
        data: locations.map((l) => ({ userId: user.id, locationId: l.id })),
        skipDuplicates: true,
      });
    }
    await writeAudit({
      businessId: scope.businessId, userId: scope.userId,
      action: "user.invite", entityType: "User", entityId: user.id,
      diff: { name: user.name, email: user.email, role: user.role },
    });
  });

  revalidatePath("/settings/users");
  return { ok: true, email: parsed.data.email, password };
}

export async function resetPasswordAction(userId: string): Promise<{ ok: true; email: string; password: string } | { error: string }> {
  await requireOwner();
  const scope = await getScope();
  const user = await prisma.user.findFirst({ where: { id: userId, businessId: scope.businessId } });
  if (!user) return { error: "User not found" };

  const password = generatePassword();
  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: userId },
    // Same as an invite: an owner picked this one, so it is good for one sign-in.
    data: { passwordHash, mustChangePassword: true },
  });

  await writeAudit({
    businessId: scope.businessId, userId: scope.userId,
    action: "user.password_reset", entityType: "User", entityId: userId,
  });

  revalidatePath("/settings/users");
  return { ok: true, email: user.email, password };
}

/*
  A reset link an owner can hand over directly — the way this works with no
  email service configured at all, and the better option when one is: the
  person picks their own password instead of being read a temporary one over
  the phone, so it is never spoken aloud or written down.
*/
export async function createResetLinkAction(
  userId: string,
): Promise<{ ok: true; url: string; expiresAt: string; name: string } | { error: string }> {
  await requireOwner();
  const scope = await getScope();
  const user = await prisma.user.findFirst({ where: { id: userId, businessId: scope.businessId } });
  if (!user) return { error: "User not found" };

  const { token, expiresAt } = await createResetToken(user.id);
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host");

  await writeAudit({
    businessId: scope.businessId, userId: scope.userId,
    action: "user.reset_link", entityType: "User", entityId: userId,
  });

  return {
    ok: true,
    url: `${proto}://${host}/reset-password?token=${token}`,
    expiresAt: expiresAt.toISOString(),
    name: user.name,
  };
}

export async function deleteUserAction(userId: string): Promise<{ ok: true } | { error: string }> {
  await requireOwner();
  const scope = await getScope();
  if (userId === scope.userId) return { error: "You can't delete your own account." };
  const user = await prisma.user.findFirst({ where: { id: userId, businessId: scope.businessId } });
  if (!user) return { error: "User not found" };

  // Block deleting the last owner (we always need at least one OWNER)
  if (user.role === "OWNER") {
    const ownerCount = await prisma.user.count({ where: { businessId: scope.businessId, role: "OWNER" } });
    if (ownerCount <= 1) return { error: "Can't delete the last owner. Promote someone else first." };
  }

  try {
    await prisma.user.delete({ where: { id: userId } });
  } catch (err) {
    // Every invoice, expense, purchase order, cash close and inventory count
    // they created still points at them on purpose — that's what reporting
    // reads "who did this" from, so it's never silently reassigned or
    // nulled out. The delete is correctly refused by the database until
    // those are moved to someone else; this just turns the raw constraint
    // error into the actual next step, since the permission check above
    // already passed and this is the real reason the delete failed, not an
    // access problem.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return {
        error: `${user.name} still has invoices, expenses, purchase orders, cash closes, or inventory counts on their account. Open their profile and reassign those to someone else first, then delete.`,
      };
    }
    throw err;
  }

  await writeAudit({
    businessId: scope.businessId, userId: scope.userId,
    action: "user.delete", entityType: "User", entityId: userId,
    diff: { name: user.name, email: user.email },
  });
  revalidatePath("/settings/users");
  return { ok: true };
}

/** Everything a reassignment below would move — shown before it runs. */
export async function getReassignableCounts(userId: string) {
  // Exported from a "use server" file, so this is a callable endpoint like any
  // other action, not just a helper the page imports — without this it hands
  // anyone signed in a read of how much work any colleague has on their name.
  await requireOwner();
  const [purchaseOrders, invoices, expenses, capitalAssets, cashClosesClosed, cashClosesVerified, inventoryCounts] =
    await Promise.all([
      prisma.purchaseOrder.count({ where: { createdById: userId } }),
      prisma.invoice.count({ where: { createdById: userId } }),
      prisma.expense.count({ where: { createdById: userId } }),
      prisma.capitalAsset.count({ where: { createdById: userId } }),
      prisma.cashClose.count({ where: { closedById: userId } }),
      prisma.cashClose.count({ where: { verifiedById: userId } }),
      prisma.inventoryCount.count({ where: { countedById: userId } }),
    ]);
  return { purchaseOrders, invoices, expenses, capitalAssets, cashClosesClosed, cashClosesVerified, inventoryCounts };
}

/**
 * Moves every record attributed to `fromUserId` onto `toUserId` — the seven
 * places a user is recorded as having done something (see the schema's User
 * relations). This is what actually clears the path to deleting an old
 * account: the FK on each of these is deliberately required, not nullable,
 * because reporting depends on "who created this" pointing at a real person,
 * so departing staff have to be handed off rather than erased.
 */
export type ReassignCounts = {
  purchaseOrders: number;
  invoices: number;
  expenses: number;
  capitalAssets: number;
  cashClosesClosed: number;
  cashClosesVerified: number;
  inventoryCounts: number;
};

export async function reassignUserRecordsAction(
  fromUserId: string,
  toUserId: string,
): Promise<{ ok: true; counts: ReassignCounts } | { error: string }> {
  await requireOwner();
  const scope = await getScope();
  if (fromUserId === toUserId) return { error: "Pick someone else to reassign to." };

  const [from, to] = await Promise.all([
    prisma.user.findFirst({ where: { id: fromUserId, businessId: scope.businessId } }),
    prisma.user.findFirst({ where: { id: toUserId, businessId: scope.businessId } }),
  ]);
  if (!from) return { error: "Source user not found" };
  if (!to) return { error: "Target user not found" };

  const counts = await prisma.$transaction(async (tx) => {
    const [purchaseOrders, invoices, expenses, capitalAssets, cashClosesClosed, cashClosesVerified, inventoryCounts] =
      await Promise.all([
        tx.purchaseOrder.updateMany({ where: { createdById: fromUserId }, data: { createdById: toUserId } }),
        tx.invoice.updateMany({ where: { createdById: fromUserId }, data: { createdById: toUserId } }),
        tx.expense.updateMany({ where: { createdById: fromUserId }, data: { createdById: toUserId } }),
        tx.capitalAsset.updateMany({ where: { createdById: fromUserId }, data: { createdById: toUserId } }),
        tx.cashClose.updateMany({ where: { closedById: fromUserId }, data: { closedById: toUserId } }),
        tx.cashClose.updateMany({ where: { verifiedById: fromUserId }, data: { verifiedById: toUserId } }),
        tx.inventoryCount.updateMany({ where: { countedById: fromUserId }, data: { countedById: toUserId } }),
      ]);
    return {
      purchaseOrders: purchaseOrders.count,
      invoices: invoices.count,
      expenses: expenses.count,
      capitalAssets: capitalAssets.count,
      cashClosesClosed: cashClosesClosed.count,
      cashClosesVerified: cashClosesVerified.count,
      inventoryCounts: inventoryCounts.count,
    };
  });

  await writeAudit({
    businessId: scope.businessId, userId: scope.userId,
    action: "user.reassign_records", entityType: "User", entityId: fromUserId,
    diff: { from: { id: from.id, name: from.name }, to: { id: to.id, name: to.name }, counts },
  });

  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${fromUserId}`);
  return { ok: true, counts };
}

export async function updateUserRoleAction(
  userId: string,
  role: Role,
): Promise<{ ok: true } | { error: string }> {
  await requireOwner();
  const scope = await getScope();
  if (userId === scope.userId && role !== "OWNER") {
    return { error: "You can't demote yourself." };
  }
  const user = await prisma.user.findFirst({ where: { id: userId, businessId: scope.businessId } });
  if (!user) return { error: "User not found" };

  // Any move off OWNER, not just the one to MANAGER: checking for the single
  // named target let the last owner be demoted to STAFF, which locks the
  // business out of its own settings with nobody able to undo it.
  if (user.role === "OWNER" && role !== "OWNER") {
    const ownerCount = await prisma.user.count({ where: { businessId: scope.businessId, role: "OWNER" } });
    if (ownerCount <= 1) return { error: "Can't demote the last owner. Promote someone else first." };
  }

  await prisma.user.update({ where: { id: userId }, data: { role } });
  await writeAudit({
    businessId: scope.businessId, userId: scope.userId,
    action: "user.role_change", entityType: "User", entityId: userId,
    diff: { from: user.role, to: role },
  });
  revalidatePath("/settings/users");
  return { ok: true };
}
