import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyPushDecision } from "@/modules/push/decision";

/*
  Answers the Approve / Decline buttons on a notification. Public to the
  session middleware because a service worker may have no usable session; the
  signed, expiring ticket in the body is the credential (see push/token.ts).
  POST only, and it answers with a sentence, never with data.
*/
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let token: unknown;
  try {
    token = (await req.json())?.token;
  } catch {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }
  const r = await applyPushDecision(prisma, token);
  return NextResponse.json(r, { status: r.ok ? 200 : 403 });
}
