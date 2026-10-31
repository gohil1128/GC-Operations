import { prisma } from "@/lib/prisma";

/*
  One team member, end to end — mirrors the event detail page's shape: real
  numbers pulled straight from what they've actually done, not a generic
  "member since" card. This is also what the reassign flow shows before it
  moves anything, so an owner isn't asked to move records blind.
*/

export type UserProfile = Awaited<ReturnType<typeof getUserProfile>>;

export async function getUserProfile(businessId: string, userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, businessId },
    include: { locations: { include: { location: { select: { id: true, name: true } } } } },
  });
  if (!user) return null;

  const [
    purchaseOrders,
    invoiceAgg,
    expenseAgg,
    capitalAssetAgg,
    cashClosesClosed,
    cashClosesVerified,
    inventoryCounts,
    lastAudit,
  ] = await Promise.all([
    prisma.purchaseOrder.count({ where: { createdById: userId } }),
    prisma.invoice.aggregate({
      where: { createdById: userId },
      _count: true,
      _sum: { totalCents: true },
    }),
    prisma.expense.aggregate({
      where: { createdById: userId },
      _count: true,
      _sum: { amountCents: true },
    }),
    prisma.capitalAsset.aggregate({
      where: { createdById: userId },
      _count: true,
      _sum: { purchasePriceCents: true },
    }),
    prisma.cashClose.count({ where: { closedById: userId } }),
    prisma.cashClose.count({ where: { verifiedById: userId } }),
    prisma.inventoryCount.count({ where: { countedById: userId } }),
    // Own audit trail, most recent first — a quick "what have they actually
    // touched lately" feed rather than a full log viewer.
    prisma.auditLog.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  return {
    user,
    stats: {
      purchaseOrders,
      invoicesCount: invoiceAgg._count,
      invoicesTotalCents: invoiceAgg._sum.totalCents ?? 0,
      expensesCount: expenseAgg._count,
      expensesTotalCents: expenseAgg._sum.amountCents ?? 0,
      capitalAssetsCount: capitalAssetAgg._count,
      capitalAssetsTotalCents: capitalAssetAgg._sum.purchasePriceCents ?? 0,
      cashClosesClosed,
      cashClosesVerified,
      inventoryCounts,
      lastActiveAt: lastAudit?.createdAt ?? null,
    },
  };
}

/** Every OTHER user in the business — the reassign target list. */
export async function listOtherUsers(businessId: string, excludeUserId: string) {
  return prisma.user.findMany({
    where: { businessId, id: { not: excludeUserId } },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
}
