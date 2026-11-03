import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { safeEqual, MailConfigError } from "@/modules/mail/crypto";
import { syncAllSquare } from "@/modules/square/service";

/*
  The scheduled entry point for the Square sync, called by the same GitHub
  Actions schedule as the invoice scan.

  Public to the session middleware (a scheduler has no login) and protected by
  the shared CRON_SECRET instead: constant-time, fails CLOSED when the secret
  is not configured, and answers with counts only — never a sale.

  POST only, so a link preview or a crawler cannot set it off.
*/

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  const given = req.headers.get("authorization") ?? "";
  if (!safeEqual(given, `Bearer ${secret}`)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const results = await syncAllSquare("cron");
    if (results.some((r) => r.daysWritten > 0)) {
      for (const p of ["/dashboard", "/sales", "/reports", "/events", "/settings/integrations"]) revalidatePath(p);
    }
    return NextResponse.json({
      ok: true,
      synced: results.filter((r) => r.ran).length,
      results: results.map(({ ran, note, ordersRead, daysWritten, manualDaysKept, foreignCurrency, partial, error }) => ({
        ran, note, ordersRead, daysWritten, manualDaysKept: manualDaysKept.length, foreignCurrency, partial, error,
      })),
    });
  } catch (e) {
    if (e instanceof MailConfigError) return NextResponse.json({ ok: false, error: e.message }, { status: 503 });
    console.error("[square] sync failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "Sync failed." }, { status: 500 });
  }
}
