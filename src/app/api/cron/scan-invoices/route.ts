import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { safeEqual, MailConfigError } from "@/modules/mail/crypto";
import { scanAll } from "@/modules/mail/service";

/*
  The every-three-hours entry point, called by a scheduled GitHub Actions
  workflow (.github/workflows/mail-invoices.yml).

  It is deliberately public to the session middleware — a scheduler has no
  login — and protected by a shared secret instead, so everything rides on
  that comparison. It is constant-time, it fails CLOSED when the secret is not
  configured (a missing secret must never mean "anyone may call this"), and it
  answers with counts only: no sender, no subject, nothing from any email.

  POST only. A GET that triggers work is one a link preview or a crawler can
  trigger.
*/

// The platform's ceiling on a function; the scan budgets itself well inside it.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });

  const given = req.headers.get("authorization") ?? "";
  if (!safeEqual(given, `Bearer ${secret}`)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const results = await scanAll("cron");
    if (results.some((r) => r.logged > 0 || r.queued > 0)) {
      revalidatePath("/purchasing/invoices");
      revalidatePath("/dashboard");
      revalidatePath("/settings/integrations");
    }
    return NextResponse.json({
      ok: true,
      scanned: results.filter((r) => r.ran).length,
      results: results.map(({ ran, note, listed, triaged, logged, queued, skipped, failed, partial, error }) => ({
        ran, note, listed, triaged, logged, queued, skipped, failed, partial, error,
      })),
    });
  } catch (e) {
    // Not-yet-configured is an expected state, not an outage.
    if (e instanceof MailConfigError) return NextResponse.json({ ok: false, error: e.message }, { status: 503 });
    console.error("[mail] scan failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "Scan failed." }, { status: 500 });
  }
}
