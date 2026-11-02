import { NextResponse, type NextRequest } from "next/server";
import { scopeFor } from "@/lib/scope";
import { signState } from "@/modules/mail/crypto";
import { squareAuthUrl } from "@/modules/square/client";
import { missingSquareConfig } from "@/modules/square/service";

/*
  Starts "Connect Square". Settings access only — it attaches the business's
  sales to this app.

  Nothing is stored here. The state is a signed, ten-minute token naming the
  person who clicked, prefixed so a Gmail state can never complete a Square
  connection or the other way round.
*/
export async function GET(req: NextRequest) {
  const scope = await scopeFor("settings");
  if (!scope) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (missingSquareConfig().length) {
    return NextResponse.redirect(new URL("/settings/integrations?square=not-configured", req.url));
  }
  return NextResponse.redirect(squareAuthUrl(signState(`square:${scope.userId}`)));
}
