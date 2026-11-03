import { NextResponse } from "next/server";
import Papa from "papaparse";
import { scopeFor } from "@/lib/scope";
import { prisma } from "@/lib/prisma";
import { businessDayFromIso } from "@/lib/date";
import { toCents } from "@/lib/money";
import { writeAudit } from "@/lib/audit";
import { applySquareToClose } from "@/modules/cash/square-close";

// Importer for Square's "Sales Summary" page export
// (Reports → Sales summary → Export → "Summary").
//
// Format is a VERTICAL key-value CSV — no headers, no Date column. Example:
//   "Gross sales","$1,865.67"
//   "Net sales","$1,861.68"
//   "Tips","$147.78"
//   "Card","$1,772.20"
//   "Cash","$296.10"
//   "Total number of sales","189"
//
// The operator picks the business date; we extract net/tax/tips/cash/card/txn,
// upsert DailySales, and pre-fill the matching CashClose split.

export const maxDuration = 60;

function parseMoney(raw: string | undefined): number {
  if (!raw) return 0;
  let s = String(raw).trim();
  const negative = /^\(.*\)$/.test(s) || s.startsWith("-");
  s = s.replace(/[()\s$£€,]/g, "").replace(/^-/, "");
  const n = parseFloat(s);
  if (!isFinite(n)) return 0;
  return negative ? -n : n;
}

function parseInteger(raw: string | undefined): number {
  if (!raw) return 0;
  const s = String(raw).replace(/[,\s]/g, "");
  const n = parseInt(s, 10);
  return isFinite(n) ? n : 0;
}

// Build a tolerant lookup from the vertical CSV — first column = label,
// second column = value. We normalize labels (lowercase, alphanumeric only)
// so "Net sales" and "Net Sales" and "NET_SALES" all collide on the same key.
function buildLookup(rows: string[][]): Map<string, string> {
  const out = new Map<string, string>();
  for (const row of rows) {
    if (!row || row.length === 0) continue;
    const label = String(row[0] ?? "").trim();
    const value = String(row[1] ?? "").trim();
    if (!label) continue;
    const key = label.toLowerCase().replace(/[^a-z0-9]/g, "");
    // First occurrence wins so the summary block beats any later breakdown
    if (!out.has(key)) out.set(key, value);
  }
  return out;
}

function get(lookup: Map<string, string>, candidates: string[]): string | undefined {
  for (const c of candidates) {
    const key = c.toLowerCase().replace(/[^a-z0-9]/g, "");
    const v = lookup.get(key);
    if (v !== undefined) return v;
  }
  return undefined;
}

export async function POST(req: Request) {
  const scope = await scopeFor("settings");
  if (!scope) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing CSV file" }, { status: 400 });
  }

  const dateRaw = String(form.get("businessDate") ?? "").trim();
  if (!dateRaw) {
    return NextResponse.json({ error: "Pick the business date for this report" }, { status: 400 });
  }
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateRaw);
  if (!isoDate) {
    return NextResponse.json({ error: `Bad date "${dateRaw}". Use YYYY-MM-DD.` }, { status: 400 });
  }
  const businessDate = businessDayFromIso(`${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`);

  const eventIdRaw = String(form.get("eventId") ?? "");
  const eventId = eventIdRaw && eventIdRaw !== "none" ? eventIdRaw : null;
  if (eventId) {
    const exists = await prisma.event.findFirst({
      where: { id: eventId, businessId: scope.businessId },
    });
    if (!exists) return NextResponse.json({ error: "Selected event not found" }, { status: 400 });
  }

  const text = await file.text();
  const parsed = Papa.parse<string[]>(text, { header: false, skipEmptyLines: true });
  const rows = parsed.data;
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "CSV looked empty" }, { status: 400 });
  }

  const lookup = buildLookup(rows);
  const netSalesRaw = get(lookup, ["Net sales", "Net Sales", "Net"]);
  const grossRaw = get(lookup, ["Gross sales", "Gross Sales", "Gross"]);
  if (netSalesRaw === undefined && grossRaw === undefined) {
    return NextResponse.json({
      error: "Could not find a Net sales or Gross sales row. This importer expects Square's Sales Summary page export.",
      detectedLabels: rows.slice(0, 40).map((r) => r?.[0]).filter(Boolean),
    }, { status: 400 });
  }

  const netDollars = parseMoney(netSalesRaw ?? grossRaw);
  const taxDollars = parseMoney(get(lookup, ["Taxes", "Tax", "Sales tax"]));
  const tipsDollars = parseMoney(get(lookup, ["Tips", "Tip", "Gratuity"]));
  const cashDollars = parseMoney(get(lookup, ["Cash"]));
  const cardDollars = parseMoney(get(lookup, ["Card", "Credit", "Card sales"]));
  const txnCount = parseInteger(
    get(lookup, ["Total number of sales", "Sales transactions", "Total sales transactions", "Item sales transactions"]),
  );

  const netCents = toCents(netDollars);
  const taxCents = toCents(taxDollars);
  const tipsCents = toCents(tipsDollars);
  const cashCents = toCents(cashDollars);
  const cardCents = toCents(cardDollars);

  const dayData = {
    locationId: scope.locationId,
    businessDate,
    netSalesCents: netCents,
    taxCents,
    tipsCents,
    guestCount: txnCount, // 1 transaction = 1 guest per the existing convention
    eventId,
    source: "POS" as const,
  };

  const existingDay = await prisma.dailySales.findUnique({
    where: { locationId_businessDate: { locationId: scope.locationId, businessDate } },
  });
  let dayCreated = 0;
  let dayUpdated = 0;
  if (existingDay) {
    await prisma.dailySales.update({ where: { id: existingDay.id }, data: dayData });
    dayUpdated = 1;
  } else {
    await prisma.dailySales.create({ data: dayData });
    dayCreated = 1;
  }

  // What Square knows about the day's close (card takings, expected), and
  // nothing it does not — see applySquareToClose.
  const cashCloseTouched = await applySquareToClose(prisma, {
    locationId: scope.locationId, businessDate, netCents, cardCents,
  });

  await writeAudit({
    businessId: scope.businessId,
    userId: scope.userId,
    action: "square.sales_summary.import",
    entityType: "DailySales",
    diff: {
      businessDate: businessDate.toISOString(),
      dayCreated, dayUpdated,
      netCents, taxCents, tipsCents, cashCents, cardCents, txnCount,
      cashCloseTouched,
      eventId,
    },
  });

  return NextResponse.json({
    ok: true,
    businessDate: businessDate.toISOString().slice(0, 10),
    day: { created: dayCreated, updated: dayUpdated },
    totals: { netCents, taxCents, tipsCents, cashCents, cardCents, txnCount },
    cashCloseTouched,
  });
}
