import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/auth";

/*
  Turn notifications on or off for THIS browser. Owners only: the only
  notification there is goes to owners, so nobody else needs a subscription.
*/
export const dynamic = "force-dynamic";

const body = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().min(1).max(500), auth: z.string().min(1).max(500) }),
});

async function owner() {
  const me = await currentUser();
  return me && me.approved && me.role === "OWNER" ? me : null;
}

export async function POST(req: NextRequest) {
  const me = await owner();
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad subscription" }, { status: 400 });
  const { endpoint, keys } = parsed.data;
  // The endpoint belongs to one browser; if somebody else signs in on it, it moves to them.
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: me.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: req.headers.get("user-agent")?.slice(0, 200) ?? null },
    update: { userId: me.id, p256dh: keys.p256dh, auth: keys.auth },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const me = await owner();
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const endpoint = (await req.json().catch(() => null))?.endpoint;
  if (typeof endpoint !== "string") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: me.id } });
  return NextResponse.json({ ok: true });
}
