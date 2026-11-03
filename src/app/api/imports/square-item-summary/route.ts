import { NextResponse } from "next/server";
import { scopeFor } from "@/lib/scope";
import { prisma } from "@/lib/prisma";
import { parseCsv } from "@/lib/csv";
import { businessDayFromIso } from "@/lib/date";
import { toCents } from "@/lib/money";
import { writeAudit } from "@/lib/audit";

// Importer for Square's "Item Sales Summary" CSV
// (Reports → Items → Item Sales → Export).
//
// Schema: Item Name, Item Variation, SKU, Category, Items Sold, Gross Sales,
// Items Refunded, Refunds, Discounts & Comps, Net Sales, Tax, Unit,
// Units Sold, Units Refunded, GTIN
//
// Each row is an item AGGREGATE over the report's date range — there is no
// Date column in the file itself. So the operator picks the business date for
// the upload, and we treat every row as belonging to that one date.

export const maxDuration = 60;

function findCol(row: Record<string, string>, candidates: string[]): string | null {
  const keys = Object.keys(row);
  for (const c of candidates) {
    const target = c.toLowerCase().replace(/[\s_-]/g, "");
    const found = keys.find((k) => k.toLowerCase().replace(/[\s_-]/g, "") === target);
    if (found) return found;
  }
  return null;
}

function parseMoney(raw: string | undefined): number {
  if (!raw) return 0;
  let s = String(raw).trim();
  const negative = /^\(.*\)$/.test(s) || s.startsWith("-");
  s = s.replace(/[()\s$£€,]/g, "").replace(/^-/, "");
  const n = parseFloat(s);
  if (!isFinite(n)) return 0;
  return negative ? -n : n;
}

function parseQty(raw: string | undefined): number {
  if (!raw) return 0;
  const n = parseFloat(String(raw).trim());
  return isFinite(n) ? n : 0;
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
  const rows = parseCsv(text).filter((r) => Object.values(r).some((v) => String(v ?? "").trim() !== ""));
  if (rows.length === 0) {
    return NextResponse.json({ error: "CSV looked empty" }, { status: 400 });
  }

  const sample = rows[0] as Record<string, string>;
  const itemCol = findCol(sample, ["Item Name", "Item", "Product"]);
  const categoryCol = findCol(sample, ["Category", "Item Category"]);
  const qtyCol = findCol(sample, ["Items Sold", "Units Sold", "Quantity", "Qty", "Count"]);
  const netCol = findCol(sample, ["Net Sales", "Net", "Net Amount"]);
  const grossCol = findCol(sample, ["Gross Sales", "Gross", "Total"]);
  const taxCol = findCol(sample, ["Tax", "Sales Tax", "Taxes"]);
  const refundsCol = findCol(sample, ["Refunds", "Refund Amount"]);

  if (!itemCol) {
    return NextResponse.json({
      error: "Could not find an Item Name column. This importer expects Square's Item Sales Summary report.",
      detectedColumns: Object.keys(sample),
    }, { status: 400 });
  }
  if (!netCol && !grossCol) {
    return NextResponse.json({
      error: "Could not find a Net Sales or Gross Sales column.",
      detectedColumns: Object.keys(sample),
    }, { status: 400 });
  }

  let itemCreated = 0;
  let itemUpdated = 0;
  let dayNetCents = 0;
  let dayTaxCents = 0;
  let totalQty = 0;
  const errors: { row: number; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] as Record<string, string>;
    const rawName = String(r[itemCol] ?? "").trim();
    if (!rawName) {
      errors.push({ row: i + 2, reason: "Missing item name" });
      continue;
    }
    const itemName = rawName.replace(/\s+/g, " ").trim();
    const category = categoryCol ? String(r[categoryCol] ?? "").trim() || null : null;
    const qty = qtyCol ? parseQty(r[qtyCol]) : 0;
    const net = netCol ? parseMoney(r[netCol]) : parseMoney(r[grossCol!]);
    const tax = taxCol ? parseMoney(r[taxCol]) : 0;
    const refunds = refundsCol ? parseMoney(r[refundsCol]) : 0;
    // Net out refunds if Square gave a separate refunds column.
    const finalNet = net - refunds;

    const netCents = toCents(finalNet);
    const taxCents = toCents(tax);

    dayNetCents += netCents;
    dayTaxCents += taxCents;
    totalQty += qty;

    const data = {
      locationId: scope.locationId,
      businessDate,
      itemName,
      category: category && category !== "Uncategorized" ? category : null,
      qty,
      netSalesCents: netCents,
      taxCents,
      txCount: 0, // unknown at summary grain
      eventId,
    };

    const existing = await prisma.salesItem.findUnique({
      where: {
        locationId_businessDate_itemName: {
          locationId: scope.locationId,
          businessDate,
          itemName,
        },
      },
    });
    if (existing) {
      // Preserve a manually-assigned category across re-imports.
      const preserved = existing.category ? { ...data, category: existing.category } : data;
      await prisma.salesItem.update({ where: { id: existing.id }, data: preserved });
      itemUpdated++;
    } else {
      await prisma.salesItem.create({ data });
      itemCreated++;
    }
  }

  // Roll up to DailySales for the chosen date (upsert).
  const existingDay = await prisma.dailySales.findUnique({
    where: { locationId_businessDate: { locationId: scope.locationId, businessDate } },
  });
  const dayData = {
    locationId: scope.locationId,
    businessDate,
    netSalesCents: dayNetCents,
    taxCents: dayTaxCents,
    // This format doesn't carry transaction or guest count — leave at 0
    // unless the operator already entered one we should preserve.
    guestCount: existingDay?.guestCount ?? 0,
    eventId,
    source: "POS" as const,
  };
  let dayCreated = 0;
  let dayUpdated = 0;
  if (existingDay) {
    await prisma.dailySales.update({ where: { id: existingDay.id }, data: dayData });
    dayUpdated = 1;
  } else {
    await prisma.dailySales.create({ data: dayData });
    dayCreated = 1;
  }

  await writeAudit({
    businessId: scope.businessId,
    userId: scope.userId,
    action: "square.item_summary.import",
    entityType: "SalesItem",
    diff: {
      businessDate: businessDate.toISOString(),
      dayCreated, dayUpdated,
      itemCreated, itemUpdated,
      errorCount: errors.length,
      eventId,
    },
  });

  return NextResponse.json({
    ok: true,
    businessDate: businessDate.toISOString().slice(0, 10),
    day: { created: dayCreated, updated: dayUpdated, netCents: dayNetCents, taxCents: dayTaxCents },
    items: { created: itemCreated, updated: itemUpdated, total: itemCreated + itemUpdated },
    totalQty,
    detected: { itemCol, categoryCol, qtyCol, netCol, grossCol, taxCol, refundsCol },
    errors,
  });
}
