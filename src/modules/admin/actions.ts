"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getScope } from "@/lib/scope";
import { requireOwner } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { OVERVIEW_CARD_KEYS, sanitiseHiddenCards } from "@/modules/dashboard/cards";
import { CLASSIFIABLE_INVOICE_CATEGORIES } from "@/modules/reports/cost-classes";

/**
 * Wipe all operational data for the current business: ingredients, suppliers,
 * recipes, employees, sales, counts, movements, POs, invoices, expenses,
 * vendors, events, shifts, cash, deposits, report snapshots. Keeps: users,
 * locations, business itself, audit log.
 *
 * Order matters — children must be deleted before parents because most FKs
 * are NoAction by default (not Cascade). The transaction guarantees we
 * either wipe everything or nothing.
 *
 * Owner-only. Confirmation enforced on the client.
 */
export async function wipeBusinessDataAction() {
  await requireOwner();
  const scope = await getScope();

  const locationIds = (
    await prisma.location.findMany({
      where: { businessId: scope.businessId },
      select: { id: true },
    })
  ).map((l) => l.id);

  try {
    await prisma.$transaction([
      // Leaf-level transactional records first
      prisma.timeEntry.deleteMany({ where: { shift: { locationId: { in: locationIds } } } }),
      prisma.shift.deleteMany({ where: { locationId: { in: locationIds } } }),

      // Invoices reference Supplier (no cascade) — must clear before suppliers
      prisma.invoiceItem.deleteMany({ where: { invoice: { locationId: { in: locationIds } } } }),
      prisma.invoice.deleteMany({ where: { locationId: { in: locationIds } } }),

      // PO items then POs
      prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { locationId: { in: locationIds } } } }),
      prisma.purchaseOrder.deleteMany({ where: { locationId: { in: locationIds } } }),

      // Counts + movements
      prisma.inventoryCountLine.deleteMany({ where: { count: { locationId: { in: locationIds } } } }),
      prisma.inventoryCount.deleteMany({ where: { locationId: { in: locationIds } } }),
      prisma.inventoryMovement.deleteMany({ where: { locationId: { in: locationIds } } }),

      // Cash + deposits + sales — reference Event (no cascade) so must clear before events
      prisma.cashClose.deleteMany({ where: { locationId: { in: locationIds } } }),
      prisma.deposit.deleteMany({ where: { locationId: { in: locationIds } } }),
      prisma.dailySales.deleteMany({ where: { locationId: { in: locationIds } } }),
      prisma.reportSnapshot.deleteMany({ where: { businessId: scope.businessId } }),

      // Expenses reference Vendor (SET NULL) and Event (NoAction) — clear before both
      prisma.expense.deleteMany({ where: { businessId: scope.businessId } }),

      // Recipes
      prisma.recipeIngredient.deleteMany({ where: { recipe: { businessId: scope.businessId } } }),
      prisma.recipe.deleteMany({ where: { businessId: scope.businessId } }),

      // Ingredients (unit conversions cascade on ingredient delete, but be explicit)
      prisma.unitConversion.deleteMany({ where: { ingredient: { businessId: scope.businessId } } }),
      prisma.ingredient.deleteMany({ where: { businessId: scope.businessId } }),

      // Now safe to drop the rest
      prisma.vendor.deleteMany({ where: { businessId: scope.businessId } }),
      prisma.supplier.deleteMany({ where: { businessId: scope.businessId } }),
      prisma.employee.deleteMany({ where: { businessId: scope.businessId } }),
      prisma.event.deleteMany({ where: { businessId: scope.businessId } }),
    ]);
  } catch (err: any) {
    // Surface a usable error message to the client — the dialog shows it.
    const reason = err?.message ?? String(err);
    throw new Error(`Could not wipe data: ${reason.split("\n")[0]}`);
  }

  await writeAudit({
    businessId: scope.businessId,
    userId: scope.userId,
    action: "business.wipe",
    entityType: "Business",
    entityId: scope.businessId,
    diff: { wipedLocations: locationIds.length },
  });

  revalidatePath("/", "layout");
}

/*
  Valid IANA zone names only. Every business day in the app is derived from
  this, so a typo here would file cash closes against the wrong date for the
  whole business — Intl is the authority rather than a hand-kept list.
*/
const IANA_ZONE = z.string().refine(
  (tz) => {
    try {
      new Intl.DateTimeFormat("en-CA", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  },
  { message: "Not a recognised timezone" },
);

/*
  Which supplier-invoice categories this business books below the gross-profit
  line rather than against cost of goods.

  Stored as the operating-expense side, so a category nobody has classified —
  an invoice with none, or one a business invented — stays in cost of goods,
  which is where every invoice already was. The alternative would move unknown
  bills out of COGS and improve the margin without anybody deciding it should.

  Owner-only, like the rest of the business-wide settings, and filtered against
  the categories this version knows so a hand-posted value cannot sit in the
  column matching nothing.
*/
export async function setOpexInvoiceCategoriesAction(categories: unknown) {
  await requireOwner();
  const scope = await getScope();
  const parsed = z.array(z.string()).safeParse(categories);
  if (!parsed.success) return { error: "Could not read that selection." };

  const known = new Set(CLASSIFIABLE_INVOICE_CATEGORIES);
  const clean = Array.from(new Set(parsed.data.filter((c) => known.has(c))));

  await prisma.business.update({
    where: { id: scope.businessId },
    data: { opexInvoiceCategories: clean },
  });
  await writeAudit({
    businessId: scope.businessId, userId: scope.userId,
    action: "business.cost.classes", entityType: "Business", entityId: scope.businessId,
    diff: { opexInvoiceCategories: clean },
  });
  // Every page that prints a margin, but not this one — revalidating /settings
  // from an action invoked on /settings leaves the control's transition open.
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/events", "layout");
  return { ok: true as const };
}

/*
  Which Overview cards this business has turned off.

  Owner-only, like every other business-wide setting. The list is filtered
  against the cards this version actually knows about before it is stored, so a
  hand-posted key cannot sit in the column matching nothing.
*/
export async function setHiddenOverviewCardsAction(keys: unknown) {
  await requireOwner();
  const scope = await getScope();
  const parsed = z.array(z.string()).safeParse(keys);
  if (!parsed.success) return { error: "Could not read that selection." };

  const clean = sanitiseHiddenCards(parsed.data);
  // Never let every card be hidden: an Overview with nothing on it looks
  // broken rather than tidy, and there would be no control left on the page to
  // undo it from.
  if (clean.length >= OVERVIEW_CARD_KEYS.length) {
    return { error: "Keep at least one card on the Overview." };
  }

  await prisma.business.update({
    where: { id: scope.businessId },
    data: { hiddenOverviewCards: clean },
  });
  await writeAudit({
    businessId: scope.businessId, userId: scope.userId,
    action: "business.overview.cards", entityType: "Business", entityId: scope.businessId,
    diff: { hidden: clean },
  });
  /*
    Only the Overview is revalidated, not this page.

    Revalidating /settings from an action invoked ON /settings re-renders the
    page underneath the control while its transition is still open, and the
    transition never settles — the fieldset stayed disabled and only one card
    could be toggled per page load. Found by driving the real control; a single
    toggle looks completely fine.

    There is nothing here to refresh anyway: the checkbox already shows what the
    person chose.
  */
  revalidatePath("/dashboard");
  return { ok: true as const };
}

const businessSchema = z.object({
  name: z.string().min(1, "Name is required"),
  timezone: IANA_ZONE,
  foodTargetPct: z.coerce.number().int().min(0).max(100),
  laborTargetPct: z.coerce.number().int().min(0).max(100),
  ebitdaMultiplier: z.coerce.number().min(0).max(50).default(4),
  revenueMultiplier: z.coerce.number().min(0).max(20).default(1.5),
});

export async function updateBusinessAction(formData: FormData) {
  await requireOwner();
  const scope = await getScope();
  const parsed = businessSchema.parse({
    name: formData.get("name"),
    timezone: formData.get("timezone"),
    foodTargetPct: formData.get("foodTargetPct"),
    laborTargetPct: formData.get("laborTargetPct"),
    ebitdaMultiplier: formData.get("ebitdaMultiplier"),
    revenueMultiplier: formData.get("revenueMultiplier"),
  });
  await prisma.business.update({
    where: { id: scope.businessId },
    data: {
      name: parsed.name,
      timezone: parsed.timezone,
      foodTargetPct: parsed.foodTargetPct,
      laborTargetPct: parsed.laborTargetPct,
      ebitdaMultiplier: parsed.ebitdaMultiplier,
      revenueMultiplier: parsed.revenueMultiplier,
    },
  });
  await writeAudit({ businessId: scope.businessId, userId: scope.userId, action: "business.update", entityType: "Business", entityId: scope.businessId, diff: { name: parsed.name, timezone: parsed.timezone } });
  revalidatePath("/", "layout");
}
