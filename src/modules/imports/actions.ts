"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getScope } from "@/lib/scope";
import { requireOwner } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

// Delete all imported sales (DailySales + per-item SalesItem) for a single
// business day at the active location. CashClose rows are left intact — the
// CSV importers only *update* their splits, they don't create them — but we
// zero out the cash/credit split we may have written so the close isn't stale.
export async function deleteImportedDayAction(iso: string) {
  await requireOwner();
  const scope = await getScope();
  const businessDate = new Date(iso);
  if (isNaN(businessDate.getTime())) throw new Error("Bad date");

  const [salesDeleted, itemsDeleted] = await prisma.$transaction([
    prisma.dailySales.deleteMany({ where: { locationId: scope.locationId, businessDate } }),
    prisma.salesItem.deleteMany({ where: { locationId: scope.locationId, businessDate } }),
  ]);

  await writeAudit({
    businessId: scope.businessId,
    userId: scope.userId,
    action: "import.delete_day",
    entityType: "DailySales",
    diff: { date: iso, salesDeleted: salesDeleted.count, itemsDeleted: itemsDeleted.count },
  });
  revalidatePath("/settings/integrations");
  revalidatePath("/dashboard");
  return { salesDeleted: salesDeleted.count, itemsDeleted: itemsDeleted.count };
}

// Delete every imported sales row tagged with a given event at this location.
export async function deleteImportedEventDataAction(eventId: string) {
  await requireOwner();
  const scope = await getScope();
  const ev = await prisma.event.findFirst({ where: { id: eventId, businessId: scope.businessId } });
  if (!ev) throw new Error("Event not found");

  const [salesDeleted, itemsDeleted] = await prisma.$transaction([
    prisma.dailySales.deleteMany({ where: { locationId: scope.locationId, eventId } }),
    prisma.salesItem.deleteMany({ where: { locationId: scope.locationId, eventId } }),
  ]);

  await writeAudit({
    businessId: scope.businessId,
    userId: scope.userId,
    action: "import.delete_event_data",
    entityType: "Event",
    entityId: eventId,
    diff: { event: ev.name, salesDeleted: salesDeleted.count, itemsDeleted: itemsDeleted.count },
  });
  revalidatePath("/settings/integrations");
  revalidatePath("/dashboard");
  return { salesDeleted: salesDeleted.count, itemsDeleted: itemsDeleted.count };
}

// Nuclear option — wipe ALL imported sales at this location. Used when the
// operator wants to "re-enter everything" from scratch.
export async function deleteAllImportedAction() {
  await requireOwner();
  const scope = await getScope();

  const [salesDeleted, itemsDeleted] = await prisma.$transaction([
    prisma.dailySales.deleteMany({ where: { locationId: scope.locationId } }),
    prisma.salesItem.deleteMany({ where: { locationId: scope.locationId } }),
  ]);

  await writeAudit({
    businessId: scope.businessId,
    userId: scope.userId,
    action: "import.delete_all",
    entityType: "DailySales",
    diff: { locationId: scope.locationId, salesDeleted: salesDeleted.count, itemsDeleted: itemsDeleted.count },
  });
  revalidatePath("/settings/integrations");
  revalidatePath("/dashboard");
  return { salesDeleted: salesDeleted.count, itemsDeleted: itemsDeleted.count };
}

/*
  Tag imported (CSV or Square) days with an event, or clear the tag.

  Square's sync only tags a day by itself when exactly one event's dates cover
  it; everything else comes in untagged. This is how an owner assigns those,
  one day or a whole range. Once a day has a tag the sync keeps it, so a later
  sync never undoes this. The day's item rows move with it, so the event's
  items, premix and totals all follow.
*/
export async function tagImportedDaysAction(isoDays: string[], eventId: string | null) {
  await requireOwner();
  const scope = await getScope();
  const days = [...new Set(isoDays)].map((d) => new Date(d)).filter((d) => !isNaN(d.getTime()));
  if (days.length === 0) throw new Error("No days chosen.");
  if (days.length > 500) throw new Error("That is too many days at once.");
  if (eventId) {
    const ev = await prisma.event.findFirst({ where: { id: eventId, businessId: scope.businessId } });
    if (!ev) throw new Error("Event not found.");
  }
  const where = { locationId: scope.locationId, businessDate: { in: days } };
  const [sales, items] = await prisma.$transaction([
    prisma.dailySales.updateMany({ where, data: { eventId } }),
    prisma.salesItem.updateMany({ where, data: { eventId } }),
  ]);
  await writeAudit({
    businessId: scope.businessId,
    userId: scope.userId,
    action: "import.tag_days",
    entityType: "DailySales",
    diff: { days: days.length, eventId, sales: sales.count, items: items.count },
  });
  for (const p of ["/settings", "/dashboard", "/sales", "/reports", "/events"]) revalidatePath(p, "layout");
  return { days: sales.count };
}

/** Tag every synced/imported day that has no event yet (at this location) with one event. */
export async function tagUntaggedDaysAction(eventId: string) {
  await requireOwner();
  const scope = await getScope();
  const ev = await prisma.event.findFirst({ where: { id: eventId, businessId: scope.businessId } });
  if (!ev) throw new Error("Event not found.");
  const where = { locationId: scope.locationId, eventId: null };
  const [sales, items] = await prisma.$transaction([
    prisma.dailySales.updateMany({ where, data: { eventId } }),
    prisma.salesItem.updateMany({ where, data: { eventId } }),
  ]);
  await writeAudit({
    businessId: scope.businessId, userId: scope.userId,
    action: "import.tag_untagged", entityType: "Event", entityId: eventId,
    diff: { event: ev.name, days: sales.count, items: items.count },
  });
  for (const p of ["/settings", "/dashboard", "/sales", "/reports", "/events"]) revalidatePath(p, "layout");
  return { days: sales.count };
}
