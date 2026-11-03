import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { scopeFor } from "@/lib/scope";
import { writeAudit } from "@/lib/audit";
import { todayIsoIn } from "@/lib/date";
import { encryptSecret, verifyState } from "@/modules/mail/crypto";
import { createSquareClient, exchangeCode, revokeMerchant } from "@/modules/square/client";
import { addDaysIso } from "@/modules/square/aggregate";
import { INITIAL_LOOKBACK_DAYS } from "@/modules/square/sync";

/*
  Where Square sends the browser back.

  The state must be genuine, unexpired, and issued to the person signed in now
  — otherwise someone could finish THEIR Square consent in YOUR session and
  feed their sales into your books.

  Every active Square location is synced into the location the owner is
  working in. A pop-up business typically has one Square location (or a few
  for different stalls), all of which are this business's sales.
*/
export async function GET(req: NextRequest) {
  const back = (s: string) => NextResponse.redirect(new URL(`/settings/integrations?square=${s}`, req.url));

  const scope = await scopeFor("settings");
  if (!scope) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const q = req.nextUrl.searchParams;
  if (q.get("error")) return back("denied");
  const state = verifyState(q.get("state"));
  if (!state || state.uid !== `square:${scope.userId}`) return back("bad-state");
  const code = q.get("code");
  if (!code) return back("bad-state");

  try {
    const grant = await exchangeCode(code);
    const api = createSquareClient(grant.accessToken);
    const [merchant, locations, business] = await Promise.all([
      api.merchant(),
      api.locations(),
      prisma.business.findUniqueOrThrow({ where: { id: scope.businessId }, select: { timezone: true } }),
    ]);
    const active = locations.filter((l) => l.status === "ACTIVE");
    if (active.length === 0) return back("no-locations");
    const timezone = active[0].timezone ?? business.timezone;

    const existing = await prisma.squareConnection.findUnique({ where: { businessId: scope.businessId } });
    const data = {
      locationId: scope.locationId,
      connectedById: scope.userId,
      merchantId: grant.merchantId || merchant.id,
      merchantName: merchant.name,
      squareLocationIds: active.map((l) => l.id),
      squareLocations: active.map((l) => ({ id: l.id, name: l.name })),
      timezone,
      refreshTokenEnc: encryptSecret(grant.refreshToken),
      status: "ACTIVE",
      statusNote: null,
      runningSince: null,
    };
    await prisma.squareConnection.upsert({
      where: { businessId: scope.businessId },
      // A first connection reads the last month. Further back is a button,
      // because it rewrites days the owner may have imported by CSV.
      create: { businessId: scope.businessId, ...data, syncedThroughDay: addDaysIso(todayIsoIn(timezone), -INITIAL_LOOKBACK_DAYS) },
      // Reconnecting keeps its place, so nothing is skipped or re-read needlessly.
      update: data,
    });

    // A different Square account replacing the old one: revoke the old grant.
    if (existing && existing.merchantId !== data.merchantId) {
      await revokeMerchant(existing.merchantId).catch(() => {});
    }

    await writeAudit({
      businessId: scope.businessId, userId: scope.userId,
      action: "square.connect", entityType: "SquareConnection",
      diff: { merchant: merchant.name, locations: active.map((l) => l.name) },
    });
    return back("connected");
  } catch (e) {
    console.error("[square] connect failed:", e instanceof Error ? e.message : e);
    return back("failed");
  }
}
