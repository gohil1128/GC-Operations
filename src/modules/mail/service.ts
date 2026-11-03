import type { MailConnection } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptSecret, MailConfigError } from "./crypto";
import { createAnthropicExtractor } from "./extract";
import { createGmailClient, refreshAccessToken, type MailClient } from "./gmail";
import { scanConnection, type ScanDeps, type ScanResult } from "./pipeline";

/*
  The production wiring: the real database, the real Gmail, the real model.
  Everything below this line is tested with fakes; this file is the thin part
  that is not, so it is kept as small as it can be.
*/

export async function mailClientFor(connection: MailConnection): Promise<MailClient> {
  // A short-lived access token is minted per scan from the stored refresh
  // token. The access token is never stored.
  const access = await refreshAccessToken(decryptSecret(connection.refreshTokenEnc));
  return createGmailClient(access);
}

/**
 * What has to be set to CONNECT a mailbox. The Anthropic key is not on this
 * list on purpose: signing in to Google needs none of it, and counting it here
 * greyed out Connect Gmail for someone who had set up Google correctly and
 * simply had not added the AI key yet.
 */
export function missingConnectConfig(): string[] {
  const need: [string, string | undefined][] = [
    ["GOOGLE_CLIENT_ID", process.env.GOOGLE_CLIENT_ID],
    ["GOOGLE_CLIENT_SECRET", process.env.GOOGLE_CLIENT_SECRET],
    ["GOOGLE_REDIRECT_URI", process.env.GOOGLE_REDIRECT_URI],
    ["MAIL_TOKEN_KEY", process.env.MAIL_TOKEN_KEY],
  ];
  return need.filter(([, v]) => !v).map(([k]) => k);
}

/** What has to be set for scanning to work: everything to connect, plus the AI key. */
export function missingConfig(): string[] {
  return [...missingConnectConfig(), ...(process.env.ANTHROPIC_API_KEY ? [] : ["ANTHROPIC_API_KEY"])];
}

export function productionDeps(): ScanDeps {
  const missing = missingConfig();
  if (missing.length) throw new MailConfigError(`Not set up yet: ${missing.join(", ")}.`);
  return { db: prisma, mailFor: mailClientFor, extractor: createAnthropicExtractor() };
}

/** Every active mailbox, one after another — they share one time budget's worth of patience. */
export async function scanAll(trigger: "cron" | "manual"): Promise<ScanResult[]> {
  const deps = productionDeps();
  const connections = await prisma.mailConnection.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
  const out: ScanResult[] = [];
  for (const c of connections) out.push(await scanConnection(c.id, trigger, deps));
  return out;
}
