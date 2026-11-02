import type { SquareConnection } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret, MailConfigError } from "@/modules/mail/crypto";
import { createSquareClient, refreshAccessToken, squareConfigured, type SquareClient } from "./client";
import { syncConnection, type SyncDeps, type SyncResult } from "./sync";

/*
  The production wiring: the real database and the real Square. Everything the
  sync decides is tested with a fake Square; this file is the thin part that
  is not, so it is kept small.
*/

export async function squareClientFor(c: SquareConnection): Promise<SquareClient> {
  // A short-lived access token is minted per run from the stored refresh token.
  const stored = decryptSecret(c.refreshTokenEnc);
  const t = await refreshAccessToken(stored);
  // Square keeps the same refresh token for this kind of grant; store a new
  // one only if it ever sends one.
  if (t.refreshToken !== stored) {
    await prisma.squareConnection.update({ where: { id: c.id }, data: { refreshTokenEnc: encryptSecret(t.refreshToken) } });
  }
  return createSquareClient(t.accessToken);
}

/** What has to be set for the sync to work, as names a person can act on. */
export function missingSquareConfig(): string[] {
  const need: [string, string | undefined][] = [
    ["SQUARE_APPLICATION_ID", process.env.SQUARE_APPLICATION_ID],
    ["SQUARE_APPLICATION_SECRET", process.env.SQUARE_APPLICATION_SECRET],
    ["SQUARE_REDIRECT_URI", process.env.SQUARE_REDIRECT_URI],
    // The same key that protects the Gmail permission protects Square's.
    ["MAIL_TOKEN_KEY", process.env.MAIL_TOKEN_KEY],
  ];
  return need.filter(([, v]) => !v).map(([k]) => k);
}

export function squareDeps(): SyncDeps {
  const missing = missingSquareConfig();
  if (missing.length || !squareConfigured()) throw new MailConfigError(`Square is not set up yet: ${missing.join(", ")}.`);
  return { db: prisma, squareFor: squareClientFor };
}

export async function syncAllSquare(trigger: "cron" | "manual"): Promise<SyncResult[]> {
  const deps = squareDeps();
  const conns = await prisma.squareConnection.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
  const out: SyncResult[] = [];
  for (const c of conns) out.push(await syncConnection(c.id, trigger, deps));
  return out;
}
