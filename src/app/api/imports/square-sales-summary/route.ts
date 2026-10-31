import { NextResponse } from "next/server";
import Papa from "papaparse";
import { scopeFor } from "@/lib/scope";
import { prisma } from "@/lib/prisma";
import { businessDayFromIso } from "@/lib/date";
import { toCents } from "@/lib/money";
import { writeAudit } from "@/lib/audit";
import { overShortCentsFor } from "@/modules/cash/reconcile";

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

  /*
    Fill in the parts of the day's close that Square actually knows.

    It used to write Square's cash SALES into CashClose.cashCents, which
    every other screen reads as the money physically counted in the till at
    the end of the day. The two are not the same number and are not even the
    same kind of number: the count includes the opening float and is missing
    whatever was paid out of the drawer during the day. Overwriting one with
    the other silently replaced a count somebody had made by hand, and the
    day stopped reconciling with no sign of why.

    It also worked out its own over/short — closing + deposit − opening −
    expected — which had drifted from the one the rest of the app uses and
    left out both paid-out and paid-in entirely, so every payout came back
    as a shortage.

    Now it writes only what Square is the authority on. Card takings are not
    counted by hand at all, so they come from the report. Expected takings is
    the day's net sales, which is exactly what the entry form suggests, so
    the two agree. The cash count is left alone: nobody but the person who
    counted the drawer knows that figure. Over/short is then re-derived with
    overShortCentsFor, the same function the form and the actions use.
  */
  let cashCloseTouched = false;
  const close = await prisma.cashClose.findFirst({
    where: { locationId: scope.locationId, businessDate },
  });
  if (close) {
    // Derived from the rows, the way the cash actions do it, rather than
    // trusting the totals cached on the close.
    const [deposits, payouts] = await Promise.all([
      prisma.deposit.findMany({ where: { locationId: scope.locationId, businessDate } }),
      prisma.cashPayout.findMany({ where: { locationId: scope.locationId, businessDate } }),
    ]);
    const depositCents = deposits.reduce((a, d) => a + d.amountCents, 0);
    const paidOutCents = payouts.reduce((a, p) => a + p.amountCents, 0);
    const expectedCents = netCents;
    const creditCents = cardCents > 0 ? cardCents : close.creditCents;
    const overShortCents = overShortCentsFor({
      cashCents: close.cashCents,
      creditCents,
      depositCents,
      paidOutCents,
      paidInCents: close.paidInCents,
      openingCents: close.openingCents,
      expectedCents,
    });
    await prisma.cashClose.update({
      where: { id: close.id },
      data: { creditCents, depositCents, paidOutCents, expectedCents, overShortCents },
    });
    cashCloseTouched = true;
  }

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
