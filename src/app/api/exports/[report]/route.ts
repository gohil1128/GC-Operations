import { NextResponse } from "next/server";
import { scopeFor } from "@/lib/scope";
import { toCsv } from "@/lib/csv";
import { findExport } from "@/modules/exports/registry";
import { isSectionLocked } from "@/modules/section-lock/actions";

// Every downloadable dataset lives in the export registry — this route just
// resolves the key, runs its builder and serves the CSV.
export async function GET(req: Request, { params }: { params: Promise<{ report: string }> }) {
  const { report } = await params;
  const def = findExport(report);
  if (!def) {
    return NextResponse.json({ error: "unknown report" }, { status: 404 });
  }

  const scope = await scopeFor("exports");
  if (!scope) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // Each export declares its own lock in the registry, so adding a download
  // cannot quietly skip the PIN the matching page sits behind.
  if (def.section && (await isSectionLocked(scope.businessId, def.section))) {
    return NextResponse.json({ error: "section locked" }, { status: 403 });
  }

  const sp = new URL(req.url).searchParams;
  const { columns, rows } = await def.build({ scope, sp });

  const csv = toCsv(rows, columns);
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${report}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
