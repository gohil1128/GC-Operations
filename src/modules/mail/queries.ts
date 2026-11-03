import { prisma } from "@/lib/prisma";
import type { Figures } from "./rules";

/*
  What the Email invoices card shows.

  Selects name their columns. The connection row holds the encrypted refresh
  token, and a `findUnique` with no `select` would hand it to a server
  component — one careless prop away from the browser. Nothing here can,
  because nothing here asks for it.
*/

export type ReviewItem = {
  id: string;
  fromAddress: string;
  subject: string;
  receivedAt: Date;
  reason: string;
  confidence: number | null;
  supplierName: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  figures: Figures | null;
  suggestedSupplierId: string | null;
  attachmentName: string | null;
};

export type ActivityItem = {
  id: string;
  status: "LOGGED" | "DISMISSED" | "FAILED";
  fromAddress: string;
  subject: string;
  receivedAt: Date;
  reason: string | null;
  invoiceId: string | null;
  totalCents: number | null;
  attempts: number;
};

export async function getMailOverview(businessId: string) {
  const conn = await prisma.mailConnection.findUnique({
    where: { businessId },
    select: {
      id: true, accountEmail: true, status: true, statusNote: true, lastScanAt: true, createdAt: true,
      connectedBy: { select: { name: true } },
    },
  });
  if (!conn) return null;

  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [review, activity, runs, skipped, suppliers] = await Promise.all([
    prisma.mailMessage.findMany({
      where: { connectionId: conn.id, status: "NEEDS_REVIEW" },
      orderBy: { receivedAt: "desc" },
      take: 50,
      select: { id: true, fromAddress: true, subject: true, receivedAt: true, reason: true, confidence: true, extracted: true, attachmentName: true },
    }),
    prisma.mailMessage.findMany({
      where: { connectionId: conn.id, status: { in: ["LOGGED", "DISMISSED", "FAILED"] } },
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: {
        id: true, status: true, fromAddress: true, subject: true, receivedAt: true, reason: true, attempts: true,
        invoice: { select: { id: true, totalCents: true } },
      },
    }),
    prisma.mailScanRun.findMany({
      where: { connectionId: conn.id },
      orderBy: { startedAt: "desc" },
      take: 1,
      select: { startedAt: true, finishedAt: true, listed: true, logged: true, queued: true, skipped: true, failed: true, partial: true, error: true, trigger: true },
    }),
    prisma.mailMessage.count({ where: { connectionId: conn.id, status: "SKIPPED", createdAt: { gte: weekAgo } } }),
    prisma.supplier.findMany({ where: { businessId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const reviewItems: ReviewItem[] = review.map((m) => {
    const x = (m.extracted ?? {}) as Record<string, unknown>;
    return {
      id: m.id,
      fromAddress: m.fromAddress,
      subject: m.subject,
      receivedAt: m.receivedAt,
      reason: m.reason ?? "Needs a look.",
      confidence: m.confidence,
      supplierName: (x.supplierName as string | null) ?? null,
      invoiceNumber: (x.invoiceNumber as string | null) ?? null,
      invoiceDate: (x.invoiceDate as string | null) ?? null,
      figures: (x.figures as Figures | null) ?? null,
      suggestedSupplierId: (x.suggestedSupplierId as string | null) ?? null,
      attachmentName: m.attachmentName,
    };
  });

  const activityItems: ActivityItem[] = activity.map((m) => ({
    id: m.id,
    status: m.status as ActivityItem["status"],
    fromAddress: m.fromAddress,
    subject: m.subject,
    receivedAt: m.receivedAt,
    reason: m.reason,
    invoiceId: m.invoice?.id ?? null,
    totalCents: m.invoice?.totalCents ?? null,
    attempts: m.attempts,
  }));

  return { conn, review: reviewItems, activity: activityItems, lastRun: runs[0] ?? null, skippedThisWeek: skipped, suppliers };
}
