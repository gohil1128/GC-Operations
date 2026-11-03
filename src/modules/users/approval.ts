import type { PrismaClient, Role } from "@prisma/client";

/*
  The two outcomes of a request to join, shared by the Settings > Users buttons
  and the "Approve" / "Decline" on a push notification, so they cannot drift.

  Approving gives the chosen role and every location of the business. It is
  never OWNER from here: handing over ownership is a deliberate act, not a click
  on a request from a stranger. Declining removes the person, who never had
  access and so has no records to untangle.

  Both only touch a user who is still WAITING (approved = false) in the given
  business, so a stale button or notification can never change anyone else.
*/
export type Decision = { ok: true; name: string; email: string } | { error: string };

export async function approveJoinRequest(
  db: PrismaClient,
  businessId: string,
  userId: string,
  role: Extract<Role, "MANAGER" | "STAFF">,
): Promise<Decision> {
  const user = await db.user.findFirst({ where: { id: userId, businessId, approved: false } });
  if (!user) return { error: "That request is no longer there." };
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { approved: true, role } });
    const locations = await tx.location.findMany({ where: { businessId }, select: { id: true } });
    if (locations.length > 0) {
      await tx.userLocation.createMany({ data: locations.map((l) => ({ userId, locationId: l.id })), skipDuplicates: true });
    }
  });
  return { ok: true, name: user.name, email: user.email };
}

export async function declineJoinRequest(db: PrismaClient, businessId: string, userId: string): Promise<Decision> {
  const user = await db.user.findFirst({ where: { id: userId, businessId, approved: false } });
  if (!user) return { error: "That request is no longer there." };
  await db.user.delete({ where: { id: userId } });
  return { ok: true, name: user.name, email: user.email };
}
