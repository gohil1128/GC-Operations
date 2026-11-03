"use server";
import { revalidatePath } from "next/cache";
import { differenceInMinutes } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getScope } from "@/lib/scope";
import { writeAudit } from "@/lib/audit";
import { toCents } from "@/lib/money";
import { employeeSchema, shiftSchema } from "./schemas";
import { requireCan } from "@/lib/auth";
import { ownedId, requiredOwnedId, assertAllOwned } from "@/lib/ownership";

export async function createEmployeeAction(formData: FormData) {
  await requireCan("labor");
  const scope = await getScope();
  const parsed = employeeSchema.parse({
    name: formData.get("name"),
    email: formData.get("email") || "",
    position: formData.get("position"),
    hourlyRateDollars: formData.get("hourlyRateDollars"),
    isActive: formData.get("isActive") === "on" || formData.get("isActive") === "true",
  });
  const e = await prisma.employee.create({
    data: {
      businessId: scope.businessId,
      name: parsed.name,
      email: parsed.email || null,
      position: parsed.position,
      hourlyRateCents: toCents(parsed.hourlyRateDollars),
      isActive: parsed.isActive,
    },
  });
  await writeAudit({ businessId: scope.businessId, userId: scope.userId, action: "employee.create", entityType: "Employee", entityId: e.id });
  revalidatePath("/labor/employees");
}

export async function createShiftAction(payload: unknown) {
  await requireCan("labor");
  const scope = await getScope();
  const parsed = shiftSchema.parse(payload);

  // A shift carries the employee's pay rate into the labor report, so an
  // unowned id would price this business's labour off another one's wages.
  const employeeId = await requiredOwnedId("employee", scope.businessId, parsed.employeeId);
  const start = new Date(parsed.start);
  const end = new Date(parsed.end);
  if (end <= start) throw new Error("End must be after start");
  const minutes = differenceInMinutes(end, start);
  const s = await prisma.shift.create({
    data: {
      locationId: scope.locationId,
      employeeId,
      position: parsed.position,
      start, end,
      scheduledMinutes: minutes,
      notes: parsed.notes ?? null,
    },
  });
  await writeAudit({ businessId: scope.businessId, userId: scope.userId, action: "shift.create", entityType: "Shift", entityId: s.id });
  revalidatePath("/labor");
}

export async function deleteShiftAction(id: string) {
  await requireCan("labor");
  const scope = await getScope();
  const s = await prisma.shift.findFirst({ where: { id, locationId: scope.locationId } });
  if (!s) throw new Error("Not found");
  await prisma.shift.delete({ where: { id } });
  await writeAudit({ businessId: scope.businessId, userId: scope.userId, action: "shift.delete", entityType: "Shift", entityId: id });
  revalidatePath("/labor");
}

export async function deleteEmployeeAction(id: string) {
  await requireCan("labor");
  const scope = await getScope();
  const e = await prisma.employee.findFirst({ where: { id, businessId: scope.businessId } });
  if (!e) throw new Error("Not found");
  // Shifts and TimeEntry: cascade shifts manually, TimeEntry cascades on Shift
  await prisma.$transaction([
    prisma.shift.deleteMany({ where: { employeeId: id } }),
    prisma.employee.delete({ where: { id } }),
  ]);
  await writeAudit({ businessId: scope.businessId, userId: scope.userId, action: "employee.delete", entityType: "Employee", entityId: id, diff: { name: e.name } });
  revalidatePath("/labor/employees");
  revalidatePath("/labor");
}
