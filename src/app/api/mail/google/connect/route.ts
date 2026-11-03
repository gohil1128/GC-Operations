import { NextResponse, type NextRequest } from "next/server";
import { scopeFor } from "@/lib/scope";
import { googleAuthUrl, googleConfigured } from "@/modules/mail/gmail";
import { signState } from "@/modules/mail/crypto";

/*
  Starts "Connect Gmail". Owners only — a mailbox connection reads the
  business's email, which is not something a manager should be able to attach.

  Nothing is stored here. The state is a signed, ten-minute token that names
  the person who clicked, which is what the callback checks, so a link someone
  else sends you cannot attach THEIR Google grant to YOUR business.
*/
export async function GET(req: NextRequest) {
  const scope = await scopeFor("settings");
  if (!scope) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const back = (mail: string) => NextResponse.redirect(new URL(`/settings/integrations?mail=${mail}`, req.url));
  if (!googleConfigured() || !process.env.MAIL_TOKEN_KEY) return back("not-configured");

  return NextResponse.redirect(googleAuthUrl(signState(scope.userId)));
}
