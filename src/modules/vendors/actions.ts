"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getScope } from "@/lib/scope";
import { writeAudit } from "@/lib/audit";
import { toCents } from "@/lib/money";
import { businessDayFromIso } from "@/lib/date";
import { vendorSchema, payVendorSchema, incentiveSchema } from "./schemas";
import { requireCan } from "@/lib/auth";

export async function createVendorAction(formData: FormData) {
  await requireCan("expenses");
  const scope = await getScope();
  const parsed = vendorSchema.parse({
    name: formData.get("name"),
    role: formData.get("role"),
    country: formData.get("country"),
    monthlyFeeDollars: formData.get("monthlyFeeDollars"),
    currency: formData.get("currency") || "CAD",
    defaultCategory: formData.get("defaultCategory") || "CONTRACTOR",
    isFlatFee: formData.get("isFlatFee") !== "false",
    notes: formData.get("notes"),
    isActive: formData.get("isActive") !== "false",
  });
  const v = await prisma.vendor.create({
    data: {
      businessId: scope.businessId,
      name: parsed.name,
      role: parsed.role || null,
      country: parsed.country || null,
      monthlyFeeCents: toCents(parsed.monthlyFeeDollars),
      currency: parsed.currency,
      defaultCategory: parsed.defaultCategory,
      isFlatFee: parsed.isFlatFee,
      notes: parsed.notes || null,
      isActive: parsed.isActive,
    },
  });
  await writeAudit({
    businessId: scope.businessId, userId: scope.userId,
    action: "vendor.create", entityType: "Vendor", entityId: v.id,
    diff: { name: v.name, monthlyFee: parsed.monthlyFeeDollars },
  });
  revalidatePath("/expenses");
}

export async function updateVendorAction(id: string, formData: FormData) {
  await requireCan("expenses");
  const scope = await getScope();
  const parsed = vendorSchema.parse({
    name: formData.get("name"),
    role: formData.get("role"),
    country: formData.get("country"),
    monthlyFeeDollars: formData.get("monthlyFeeDollars"),
    currency: formData.get("currency") || "CAD",
    defaultCategory: formData.get("defaultCategory") || "CONTRACTOR",
    isFlatFee: formData.get("isFlatFee") !== "false",
    notes: formData.get("notes"),
    isActive: formData.get("isActive") !== "false",
  });
  const existing = await prisma.vendor.findFirst({ where: { id, businessId: scope.businessId } });
  if (!existing) throw new Error("Not found");
  await prisma.vendor.update({
    where: { id },
    data: {
      name: parsed.name,
      role: parsed.role || null,
      country: parsed.country || null,
      monthlyFeeCents: toCents(parsed.monthlyFeeDollars),
      currency: parsed.currency,
      defaultCategory: parsed.defaultCategory,
      isFlatFee: parsed.isFlatFee,
      notes: parsed.notes || null,
      isActive: parsed.isActive,
    },
  });
  await writeAudit({ businessId: scope.businessId, userId: scope.userId, action: "vendor.update", entityType: "Vendor", entityId: id });
  revalidatePath("/expenses");
}

export async function deleteVendorAction(id: string) {
  await requireCan("expenses");
  const scope = await getScope();
  const v = await prisma.vendor.findFirst({ where: { id, businessId: scope.businessId } });
  if (!v) throw new Error("Not found");
  // Expenses keep their record (vendorId is set NULL on delete) so historical
  // EBITDA / spend numbers stay correct.
  await prisma.vendor.delete({ where: { id } });
  await writeAudit({ businessId: scope.businessId, userId: scope.userId, action: "vendor.delete", entityType: "Vendor", entityId: id, diff: { name: v.name } });
  revalidatePath("/expenses");
}

/**
 * One-click "Pay vendor for this month". Creates a non-incentive Expense
 * row using the vendor's defaultCategory and monthly fee (unless overridden).
 */
export async function payVendorAction(formData: FormData) {
  await requireCan("expenses");
  const scope = await getScope();
  const parsed = payVendorSchema.parse({
    vendorId: formData.get("vendorId"),
    businessDate: formData.get("businessDate"),
    amountDollars: formData.get("amountDollars"),
    description: formData.get("description"),
  });
  const vendor = await prisma.vendor.findFirst({ where: { id: parsed.vendorId, businessId: scope.businessId } });
  if (!vendor) throw new Error("Vendor not found");

  await prisma.expense.create({
    data: {
      businessId: scope.businessId,
      locationId: scope.locationId,
      vendorId: vendor.id,
      category: vendor.defaultCategory,
      businessDate: businessDayFromIso(parsed.businessDate),
      amountCents: toCents(parsed.amountDollars),
      description: parsed.description || `${vendor.name} — monthly fee`,
      isIncentive: false,
      createdById: scope.userId,
    },
  });
  await writeAudit({
    businessId: scope.businessId, userId: scope.userId,
    action: "vendor.pay", entityType: "Vendor", entityId: vendor.id,
    diff: { amount: parsed.amountDollars, when: parsed.businessDate },
  });
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}

/**
 * Log a one-off performance incentive for a vendor. Same expense row but
 * isIncentive=true so it can be excluded from "fixed monthly cost" math
 * and surfaced separately on the vendor's history.
 */
export async function logIncentiveAction(formData: FormData) {
  await requireCan("expenses");
  const scope = await getScope();
  const parsed = incentiveSchema.parse({
    vendorId: formData.get("vendorId"),
    businessDate: formData.get("businessDate"),
    amountDollars: formData.get("amountDollars"),
    description: formData.get("description"),
    performanceNote: formData.get("performanceNote"),
  });
  const vendor = await prisma.vendor.findFirst({ where: { id: parsed.vendorId, businessId: scope.businessId } });
  if (!vendor) throw new Error("Vendor not found");

  const note = [parsed.description, parsed.performanceNote ? `Performance: ${parsed.performanceNote}` : null]
    .filter(Boolean)
    .join(" · ") || `${vendor.name} — performance incentive`;

  await prisma.expense.create({
    data: {
      businessId: scope.businessId,
      locationId: scope.locationId,
      vendorId: vendor.id,
      category: vendor.defaultCategory,
      businessDate: businessDayFromIso(parsed.businessDate),
      amountCents: toCents(parsed.amountDollars),
      description: note,
      isIncentive: true,
      createdById: scope.userId,
    },
  });
  await writeAudit({
    businessId: scope.businessId, userId: scope.userId,
    action: "vendor.incentive", entityType: "Vendor", entityId: vendor.id,
    diff: { amount: parsed.amountDollars, when: parsed.businessDate },
  });
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}
