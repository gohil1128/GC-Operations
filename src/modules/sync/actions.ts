"use server";
import { prisma } from "@/lib/prisma";
import { getScope } from "@/lib/scope";
import { requireCan } from "@/lib/auth";
import { syncSquareNowAction } from "@/modules/square/actions";
import { scanNowAction } from "@/modules/mail/actions";

/*
  One button for "bring everything up to date": Square sales, and the Gmail
  invoice scan when it is connected and AI reading is on. Each part keeps its
  own rules (throttles, permissions, windows); this only runs them together
  and says what happened in one line.
*/
export type SyncAllReply = { ok: boolean; message: string };

export async function syncEverythingAction(): Promise<SyncAllReply> {
  await requireCan("settings");
  const scope = await getScope();
  const [square, mail, biz] = await Promise.all([
    prisma.squareConnection.findUnique({ where: { businessId: scope.businessId }, select: { status: true } }),
    prisma.mailConnection.findUnique({ where: { businessId: scope.businessId }, select: { status: true } }),
    prisma.business.findUnique({ where: { id: scope.businessId }, select: { aiScanningEnabled: true } }),
  ]);

  const parts: { label: string; ok: boolean; message: string }[] = [];
  if (square) {
    const r = await syncSquareNowAction();
    parts.push({ label: "Square", ...r });
  }
  if (mail && biz?.aiScanningEnabled) {
    const r = await scanNowAction();
    parts.push({ label: "Email", ...r });
  }
  if (parts.length === 0) return { ok: false, message: "Connect Square or Gmail in Settings first." };
  return {
    ok: parts.every((p) => p.ok),
    message: parts.map((p) => `${p.label}: ${p.message}`).join("\n"),
  };
}
