import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { scopeFor } from "@/lib/scope";
import { writeAudit } from "@/lib/audit";
import { encryptSecret, verifyState } from "@/modules/mail/crypto";
import { exchangeCode, fetchProfileEmail, GMAIL_SCOPE, revokeToken } from "@/modules/mail/gmail";
import { decryptSecret } from "@/modules/mail/crypto";
import { INITIAL_LOOKBACK_DAYS } from "@/modules/mail/config";

/*
  Where Google sends the browser back.

  Three checks before anything is stored, in order of how bad it is to skip
  them: the state must be genuine and unexpired; it must have been issued to
  the person who is signed in now (otherwise an attacker could finish THEIR
  consent screen in YOUR session); and the grant must really include the read
  permission, because Google lets a person untick it on the consent screen.
*/
export async function GET(req: NextRequest) {
  const back = (mail: string) => NextResponse.redirect(new URL(`/settings/integrations?mail=${mail}`, req.url));

  const scope = await scopeFor("settings");
  if (!scope) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const q = req.nextUrl.searchParams;
  if (q.get("error")) return back("denied");

  const state = verifyState(q.get("state"));
  if (!state || state.uid !== scope.userId) return back("bad-state");
  const code = q.get("code");
  if (!code) return back("bad-state");

  try {
    const grant = await exchangeCode(code);
    if (!grant.scope.split(" ").includes(GMAIL_SCOPE)) return back("no-permission");

    const accountEmail = await fetchProfileEmail(grant.accessToken);
    const existing = await prisma.mailConnection.findUnique({ where: { businessId: scope.businessId } });

    const data = {
      locationId: scope.locationId,
      connectedById: scope.userId,
      accountEmail,
      refreshTokenEnc: encryptSecret(grant.refreshToken),
      scope: grant.scope,
      status: "ACTIVE",
      statusNote: null,
    };
    await prisma.mailConnection.upsert({
      where: { businessId: scope.businessId },
      create: {
        businessId: scope.businessId,
        ...data,
        // A first connection looks back a week, no further: a mailbox full of
        // old bills the owner already entered is not something to re-log.
        scannedThrough: new Date(Date.now() - INITIAL_LOOKBACK_DAYS * 86_400_000),
      },
      // Reconnecting keeps the cursor, so nothing is re-read or skipped.
      update: data,
    });

    // A replaced grant is revoked so the old one cannot be used from anywhere.
    if (existing) await revokeToken(decryptSecret(existing.refreshTokenEnc)).catch(() => {});

    await writeAudit({
      businessId: scope.businessId, userId: scope.userId,
      action: "mail.connect", entityType: "MailConnection",
      diff: { account: accountEmail },
    });
    return back("connected");
  } catch (e) {
    console.error("[mail] connect failed:", e instanceof Error ? e.message : e);
    return back("failed");
  }
}
