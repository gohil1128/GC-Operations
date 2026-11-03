import { prisma } from "@/lib/prisma";
import { businessDayOrNull, endOfBusinessDayOrNull } from "@/lib/date";
import type { ExpenseCategory } from "@prisma/client";

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "RENT", label: "Rent" },
  { value: "UTILITIES", label: "Utilities" },
  { value: "MARKETING", label: "Marketing" },
  { value: "CONTRACTOR", label: "Contractor / Freelancer" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "EQUIPMENT", label: "Equipment" },
  { value: "REPAIRS", label: "Repairs" },
  { value: "ADMIN", label: "Admin / Office" },
  { value: "OTHER", label: "Other" },
];

export type ExpenseFilters = {
  category?: ExpenseCategory;
  eventId?: string;
  from?: string;
  to?: string;
};

export async function listExpenses(locationId: string, filters: ExpenseFilters = {}) {
  const where: any = { locationId };
  if (filters.category) where.category = filters.category;
  if (filters.eventId) where.eventId = filters.eventId;
  if (filters.from || filters.to) {
    where.businessDate = {};
    const from = businessDayOrNull(filters.from);
    const to = endOfBusinessDayOrNull(filters.to);
    if (from) where.businessDate.gte = from;
    if (to) where.businessDate.lte = to;
  }
  return prisma.expense.findMany({
    where,
    include: {
      createdBy: { select: { name: true } },
      event: { select: { id: true, name: true, color: true } },
      vendor: { select: { id: true, name: true } },
    },
    orderBy: { businessDate: "desc" },
  });
}
