"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getScope } from "@/lib/scope";
import { writeAudit } from "@/lib/audit";
import { toCents } from "@/lib/money";
import { businessDayFromIso } from "@/lib/date";
import { expenseSchema } from "./schemas";
import { requireCan } from "@/lib/auth";
import { ownedId, requiredOwnedId, assertAllOwned } from "@/lib/ownership";

export async function createExpenseAction(formData: FormData) {
  await requireCan("expenses");
  const scope = await getScope();
  const parsed = expenseSchema.parse({
    category: formData.get("category"),
    businessDate: formData.get("businessDate"),
    amountDollars: formData.get("amountDollars"),
    description: formData.get("description"),
    eventId: formData.get("eventId") || null,
  });
  const e = await prisma.expense.create({
    data: {
      businessId: scope.businessId,
      locationId: scope.locationId,
      eventId: await ownedId("event", scope.businessId, parsed.eventId),
      category: parsed.category,
      businessDate: businessDayFromIso(parsed.businessDate),
      amountCents: toCents(parsed.amountDollars),
      description: parsed.description || null,
      createdById: scope.userId,
    },
  });
  await writeAudit({
    businessId: scope.businessId, userId: scope.userId,
    action: "expense.create", entityType: "Expense", entityId: e.id,
    diff: { category: e.category, amount: parsed.amountDollars },
  });
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}

export async function updateExpenseAction(id: string, formData: FormData) {
  await requireCan("expenses");
  const scope = await getScope();
  const parsed = expenseSchema.parse({
    category: formData.get("category"),
    businessDate: formData.get("businessDate"),
    amountDollars: formData.get("amountDollars"),
    description: formData.get("description"),
    eventId: formData.get("eventId") || null,
  });
  const existing = await prisma.expense.findFirst({
    where: { id, businessId: scope.businessId },
  });
  if (!existing) throw new Error("Not found");
  await prisma.expense.update({
    where: { id },
    data: {
      category: parsed.category,
      businessDate: businessDayFromIso(parsed.businessDate),
      amountCents: toCents(parsed.amountDollars),
      description: parsed.description || null,
      eventId: await ownedId("event", scope.businessId, parsed.eventId),
    },
  });
  await writeAudit({
    businessId: scope.businessId, userId: scope.userId,
    action: "expense.update", entityType: "Expense", entityId: id,
  });
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}

export async function deleteExpenseAction(id: string) {
  await requireCan("expenses");
  const scope = await getScope();
  const e = await prisma.expense.findFirst({ where: { id, businessId: scope.businessId } });
  if (!e) throw new Error("Not found");
  await prisma.expense.delete({ where: { id } });
  await writeAudit({
    businessId: scope.businessId, userId: scope.userId,
    action: "expense.delete", entityType: "Expense", entityId: id,
    diff: { category: e.category, amount: e.amountCents / 100 },
  });
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}
