import type { PrismaClient } from "@prisma/client";
import { approveJoinRequest, declineJoinRequest } from "@/modules/users/approval";
import { verifyDecisionToken } from "./token";

/*
  What the notification's Approve / Decline buttons call. The ticket is the
  only credential, so everything it grants is re-checked here against the
  database: the owner it was issued to must still be an approved owner of the
  same business as the waiting person, and the person must still be waiting.
  An approval from here is always Staff.
*/
export type PushDecisionResult = { ok: true; message: string } | { ok: false; message: string };

export async function applyPushDecision(db: PrismaClient, token: unknown, now = Date.now()): Promise<PushDecisionResult> {
  const claims = verifyDecisionToken(token, now);
  if (!claims) return { ok: false, message: "That link has expired. Open Settings → Users instead." };

  const approver = await db.user.findUnique({ where: { id: claims.approverId }, select: { id: true, role: true, approved: true, businessId: true } });
  if (!approver || approver.role !== "OWNER" || !approver.approved) return { ok: false, message: "Only an owner can answer this." };

  const target = await db.user.findUnique({ where: { id: claims.targetUserId }, select: { businessId: true } });
  if (!target || target.businessId !== approver.businessId) return { ok: false, message: "That request is no longer there." };

  const res =
    claims.action === "approve"
      ? await approveJoinRequest(db, approver.businessId, claims.targetUserId, "STAFF")
      : await declineJoinRequest(db, approver.businessId, claims.targetUserId);
  if ("error" in res) return { ok: false, message: res.error };

  await db.auditLog.create({
    data: {
      businessId: approver.businessId,
      userId: approver.id,
      action: claims.action === "approve" ? "user.approve" : "user.decline",
      entityType: "User",
      entityId: claims.targetUserId,
      diffJson: { email: res.email, role: claims.action === "approve" ? "STAFF" : undefined, via: "push notification" },
    },
  });
  return { ok: true, message: claims.action === "approve" ? `${res.name} approved as Staff` : `${res.name} declined` };
}
