import { NextResponse } from "next/server";
import { scopeFor } from "@/lib/scope";
import { findExport } from "@/modules/exports/registry";
import { isSectionLocked } from "@/modules/section-lock/actions";

/*
  PDF export placeholder. The contract intentionally mirrors what a real
  implementation (Playwright/react-pdf) would honor: same path, same params.

  The guards are here already, ahead of the body. This route returns no data
  today, so they protect nothing yet — but the CSV route beside it shipped with
  a hand-maintained list of which downloads sat behind the section PIN, and that
  list was missing half its entries. Whoever fills this in should inherit the
  gate rather than have to remember it.
*/
export async function GET(_req: Request, { params }: { params: Promise<{ report: string }> }) {
  const { report } = await params;

  const def = findExport(report);
  if (!def) return NextResponse.json({ error: "unknown report" }, { status: 404 });

  const scope = await scopeFor("exports");
  if (!scope) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  if (def.section && (await isSectionLocked(scope.businessId, def.section))) {
    return NextResponse.json({ error: "section locked" }, { status: 403 });
  }

  return NextResponse.json(
    {
      error: "not_implemented",
      report: def.key,
      message: "PDF export is wired but not implemented in MVP. Use the CSV export at /api/exports/[report].",
    },
    { status: 501 },
  );
}
