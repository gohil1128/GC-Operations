"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getScope } from "@/lib/scope";
import { requireCan } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { businessDayFromIso, todayIsoIn } from "@/lib/date";
import { addDaysIso } from "./aggregate";
import { revokeMerchant } from "./client";
import { squareDeps } from "./service";
import { MAX_HISTORY_DAYS, syncConnection, type SyncResult } from "./sync";

/*
  What a person can do from the Square card. Each returns { ok, message }
  rather than throwing: a thrown server-action error reaches the browser with
  its message stripped, and the useful part is *why*.
*/

type Reply = { ok: true; message: string } | { ok: false; message: string };
const fail = (message: string): Reply => ({ ok: false, message });
const done = (message: string): Reply => ({ ok: true, message });

const refresh = () => {
  for (const p of ["/settings/integrations", "/dashboard", "/sales", "/reports", "/events"]) revalidatePath(p);
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function describe(r: SyncResult): Reply {
  if (!r.ran) return fail(r.note ?? "Nothing ran.");
  if (r.error) return fail(`The sync hit a problem: ${r.error}`);
  if (r.note) return fail(r.note);
  const bits = [`${plural(r.ordersRead, "order")} read`, `${plural(r.daysWritten, "day")} updated`];
  if (r.manualDaysKept.length) bits.push(`${plural(r.manualDaysKept.length, "hand-entered day")} left as they were`);
  if (r.foreignCurrency) bits.push(`${plural(r.foreignCurrency, "sale")} in another currency left out`);
  return done(`${bits.join(", ")}.${r.partial ? " More history to go — it continues on the next sync." : ""}`);
}

async function connectionForScope() {
  await requireCan("settings");
  const scope = await getScope();
  const conn = await prisma.squareConnection.findUnique({ where: { businessId: scope.businessId } });
  return { scope, conn };
}

async function run(connectionId: string): Promise<Reply> {
  try {
    const r = await syncConnection(connectionId, "manual", squareDeps());
    refresh();
    return describe(r);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "The sync failed.");
  }
}

export async function syncSquareNowAction(): Promise<Reply> {
  const { conn } = await connectionForScope();
  if (!conn) return fail("Connect Square first.");
  if (conn.status !== "ACTIVE") return fail("Square needs reconnecting first.");
  // A button people can hold down; once every half minute is plenty.
  if (conn.lastSyncAt && Date.now() - conn.lastSyncAt.getTime() < 30_000) return fail("It just synced — give it a moment.");
  return run(conn.id);
}

/** Read further back. Only ever widens the window; never skips forward. */
export async function importSquareHistoryAction(days: number): Promise<Reply> {
  const { scope, conn } = await connectionForScope();
  if (!conn) return fail("Connect Square first.");
  if (conn.status !== "ACTIVE") return fail("Square needs reconnecting first.");
  const n = Math.round(days);
  if (!Number.isFinite(n) || n < 1 || n > MAX_HISTORY_DAYS) return fail(`Pick between 1 and ${MAX_HISTORY_DAYS} days.`);

  const from = addDaysIso(todayIsoIn(conn.timezone), -n);
  if (from < conn.syncedThroughDay) {
    await prisma.squareConnection.update({ where: { id: conn.id }, data: { syncedThroughDay: from } });
  }
  await writeAudit({
    businessId: scope.businessId, userId: scope.userId,
    action: "square.history", entityType: "SquareConnection", diff: { from },
  });
  return run(conn.id);
}

/**
 * The owner chose Square's figures over what was typed in for these days.
 * They stop being hand-entered, and the sync rebuilds them.
 */
export async function replaceManualDaysWithSquareAction(isoDays: string[]): Promise<Reply> {
  const { scope, conn } = await connectionForScope();
  if (!conn) return fail("Connect Square first.");
  const days = [...new Set(isoDays)].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (!days.length) return fail("No days chosen.");

  await prisma.dailySales.updateMany({
    where: { locationId: conn.locationId, source: "MANUAL", businessDate: { in: days.map(businessDayFromIso) } },
    data: { source: "POS" },
  });
  if (days[0] < conn.syncedThroughDay) {
    await prisma.squareConnection.update({ where: { id: conn.id }, data: { syncedThroughDay: days[0] } });
  }
  await writeAudit({
    businessId: scope.businessId, userId: scope.userId,
    action: "square.replace_manual_days", entityType: "DailySales", diff: { days },
  });
  return run(conn.id);
}

export async function disconnectSquareAction(): Promise<Reply> {
  const { scope, conn } = await connectionForScope();
  if (!conn) return done("Already disconnected.");
  // Revoke at Square first so the grant is really gone, not merely forgotten.
  // Best effort: an unreachable Square must not trap the connection here.
  await revokeMerchant(conn.merchantId).catch(() => {});
  await prisma.squareConnection.delete({ where: { id: conn.id } });
  await writeAudit({
    businessId: scope.businessId, userId: scope.userId,
    action: "square.disconnect", entityType: "SquareConnection", diff: { merchant: conn.merchantName },
  });
  refresh();
  return done("Disconnected. Sales already synced stay as they are.");
}
