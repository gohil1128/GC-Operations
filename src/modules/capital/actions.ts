"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getScope } from "@/lib/scope";
import { writeAudit } from "@/lib/audit";
import { toCents } from "@/lib/money";
import { capitalAssetSchema } from "./schemas";
import { requireCan } from "@/lib/auth";

function pickEventId(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  return s && s !== "none" ? s : null;
}

export async function createCapitalAssetAction(formData: FormData) {
  await requireCan("expenses");
  const scope = await getScope();
  const parsed = capitalAssetSchema.parse({
    name: formData.get("name"),
    category: formData.get("category"),
    vendor: formData.get("vendor"),
    purchaseDate: formData.get("purchaseDate"),
    purchasePriceDollars: formData.get("purchasePriceDollars"),
    usefulLifeMonths: formData.get("usefulLifeMonths") || null,
    salvageValueDollars: formData.get("salvageValueDollars") || 0,
    status: formData.get("status") || "IN_SERVICE",
    notes: formData.get("notes"),
    eventId: formData.get("eventId"),
  });
  const eventId = pickEventId(parsed.eventId);
  if (eventId) {
    const ev = await prisma.event.findFirst({ where: { id: eventId, businessId: scope.businessId } });
    if (!ev) throw new Error("Selected event not found");
  }
  const a = await prisma.capitalAsset.create({
    data: {
      locationId: scope.locationId,
      name: parsed.name,
      category: parsed.category?.trim() || null,
      vendor: parsed.vendor?.trim() || null,
      purchaseDate: new Date(parsed.purchaseDate),
      purchasePriceCents: toCents(parsed.purchasePriceDollars),
      usefulLifeMonths: parsed.usefulLifeMonths || null,
      salvageValueCents: toCents(parsed.salvageValueDollars ?? 0),
      status: parsed.status,
      notes: parsed.notes?.trim() || null,
      eventId,
      createdById: scope.userId,
    },
  });
  await writeAudit({
    businessId: scope.businessId, userId: scope.userId,
    action: "capital.create", entityType: "CapitalAsset", entityId: a.id,
    diff: { name: a.name, priceCents: a.purchasePriceCents },
  });
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}

export async function updateCapitalAssetAction(id: string, formData: FormData) {
  await requireCan("expenses");
  const scope = await getScope();
  const parsed = capitalAssetSchema.parse({
    name: formData.get("name"),
    category: formData.get("category"),
    vendor: formData.get("vendor"),
    purchaseDate: formData.get("purchaseDate"),
    purchasePriceDollars: formData.get("purchasePriceDollars"),
    usefulLifeMonths: formData.get("usefulLifeMonths") || null,
    salvageValueDollars: formData.get("salvageValueDollars") || 0,
    status: formData.get("status") || "IN_SERVICE",
    notes: formData.get("notes"),
    eventId: formData.get("eventId"),
  });
  const existing = await prisma.capitalAsset.findFirst({
    where: { id, locationId: scope.locationId },
  });
  if (!existing) throw new Error("Not found");
  const eventId = pickEventId(parsed.eventId);
  await prisma.capitalAsset.update({
    where: { id },
    data: {
      name: parsed.name,
      category: parsed.category?.trim() || null,
      vendor: parsed.vendor?.trim() || null,
      purchaseDate: new Date(parsed.purchaseDate),
      purchasePriceCents: toCents(parsed.purchasePriceDollars),
      usefulLifeMonths: parsed.usefulLifeMonths || null,
      salvageValueCents: toCents(parsed.salvageValueDollars ?? 0),
      status: parsed.status,
      notes: parsed.notes?.trim() || null,
      eventId,
    },
  });
  await writeAudit({
    businessId: scope.businessId, userId: scope.userId,
    action: "capital.update", entityType: "CapitalAsset", entityId: id,
  });
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}

export async function deleteCapitalAssetAction(id: string) {
  await requireCan("expenses");
  const scope = await getScope();
  const a = await prisma.capitalAsset.findFirst({ where: { id, locationId: scope.locationId } });
  if (!a) throw new Error("Not found");
  await prisma.capitalAsset.delete({ where: { id } });
  await writeAudit({
    businessId: scope.businessId, userId: scope.userId,
    action: "capital.delete", entityType: "CapitalAsset", entityId: id,
    diff: { name: a.name, priceCents: a.purchasePriceCents },
  });
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}
