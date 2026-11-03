import webpush from "web-push";
import type { PrismaClient } from "@prisma/client";
import { mintDecisionToken } from "./token";

/*
  Push notifications, for one thing so far: telling the owners that somebody
  asked to join.

  Needs a VAPID key pair (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY in Vercel; make
  one with `npx web-push generate-vapid-keys`) and VAPID_SUBJECT (a mailto: or
  https: address for the sender). Without them nothing is sent and
  the Users page says so — nothing else in the app depends on it.

  The payload carries no data beyond the person's name and email, both of which
  the owner is about to be shown anyway, and two single-purpose tickets (see
  token.ts) for the Approve / Decline buttons.
*/

/** Push services want to know who is sending: a mailto: or https: address. VAPID_SUBJECT, else the site's own URL. */
const subject = () => process.env.VAPID_SUBJECT || process.env.AUTH_URL || process.env.NEXTAUTH_URL || "";
export const pushConfigured = () => Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && subject());
export const vapidPublicKey = () => (pushConfigured() ? process.env.VAPID_PUBLIC_KEY! : null);

export type PushTarget = { endpoint: string; p256dh: string; auth: string };
/** What goes to a browser. Injectable so tests need no network and no keys. */
export type Sender = (target: PushTarget, payload: string) => Promise<void>;

export const webPushSender: Sender = async (t, payload) => {
  webpush.setVapidDetails(subject(), process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, payload, { TTL: 60 * 60 * 24 });
};

export type JoinRequestInfo = { businessId: string; userId: string; name: string; email: string };

/** The notification an owner gets. Pure, so its shape is tested. */
export function joinRequestPayload(info: JoinRequestInfo, ownerId: string, now = Date.now()) {
  return {
    title: `${info.name} wants to join`,
    body: `${info.email} signed in with Google. Approve as Staff?`,
    tag: `join-${info.userId}`,
    url: "/settings/users",
    actions: [
      { action: "approve", title: "Approve" },
      { action: "decline", title: "Decline" },
    ],
    // Which ticket each button uses; the service worker posts it back untouched.
    tokens: {
      approve: mintDecisionToken("approve", info.userId, ownerId, now),
      decline: mintDecisionToken("decline", info.userId, ownerId, now),
    },
    name: info.name,
  };
}

/**
 * Tell every owner of the business who has notifications on. Returns how many
 * were sent. A subscription the push service says is gone (404/410) is deleted,
 * and any other failure is swallowed: failing to notify must never stop the
 * person from being recorded.
 */
export async function notifyJoinRequest(db: PrismaClient, info: JoinRequestInfo, send: Sender = webPushSender): Promise<number> {
  if (send === webPushSender && !pushConfigured()) return 0;
  const subs = await db.pushSubscription.findMany({
    where: { user: { businessId: info.businessId, role: "OWNER", approved: true } },
    select: { id: true, userId: true, endpoint: true, p256dh: true, auth: true },
  });
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await send(s, JSON.stringify(joinRequestPayload(info, s.userId)));
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
      }
    }),
  );
  return sent;
}
