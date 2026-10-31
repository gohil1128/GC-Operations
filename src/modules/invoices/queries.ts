import { prisma } from "@/lib/prisma";
import { businessDayOrNull, endOfBusinessDayOrNull } from "@/lib/date";

export type InvoiceFilters = {
  supplierId?: string;
  /** Scope to one event. "All events"-tagged shared costs are included too. */
  eventId?: string | null;
  invoiceNumber?: string;
  status?: "open" | "closed" | "all";
  from?: string; // YYYY-MM-DD on invoiceDate
  to?: string;
};

// Shared by the list view and the CSV export so a download always reflects
// exactly the same filter semantics as what the operator sees on screen.
function buildInvoiceWhere(locationId: string, filters: InvoiceFilters) {
  const where: any = { locationId };
  if (filters.supplierId) where.supplierId = filters.supplierId;
  if (filters.eventId) {
    where.OR = [{ eventId: filters.eventId }, { appliesToAllEvents: true }];
  }
  if (filters.invoiceNumber) where.invoiceNumber = { contains: filters.invoiceNumber.trim(), mode: "insensitive" };
  if (filters.status === "open") where.closedAt = null;
  if (filters.status === "closed") where.closedAt = { not: null };
  if (filters.from || filters.to) {
    where.invoiceDate = {};
    const from = businessDayOrNull(filters.from);
    const to = endOfBusinessDayOrNull(filters.to);
    if (from) where.invoiceDate.gte = from;
    if (to) where.invoiceDate.lte = to;
  }
  return where;
}

export async function listInvoices(locationId: string, filters: InvoiceFilters = {}) {
  const where = buildInvoiceWhere(locationId, filters);
  // Explicit select keeps the (potentially large) imageDataUrl out of the
  // list query — a cheap second query flags which rows have a photo so the
  // list can show a clickable thumbnail icon.
  const [rows, withPhoto] = await Promise.all([
    prisma.invoice.findMany({
      where,
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        dateReceived: true,
        subtotalCents: true,
        totalCents: true,
        closedAt: true,
        appliesToAllEvents: true,
        category: true,
        supplier: { select: { name: true } },
        createdBy: { select: { name: true } },
        event: { select: { id: true, name: true, color: true } },
        _count: { select: { items: true } },
      },
      orderBy: { invoiceDate: "desc" },
    }),
    prisma.invoice.findMany({
      where: { ...where, imageDataUrl: { not: null } },
      select: { id: true },
    }),
  ]);
  const photoIds = new Set(withPhoto.map((r) => r.id));
  return rows.map((r) => ({ ...r, hasImage: photoIds.has(r.id) }));
}

// Full invoice detail for CSV export — includes the tax/shipping/rebate
// breakdown and line items that the list view omits. Same filter semantics as
// listInvoices so a download always matches what's on screen.
export async function listInvoicesForExport(locationId: string, filters: InvoiceFilters = {}) {
  return prisma.invoice.findMany({
    where: buildInvoiceWhere(locationId, filters),
    select: {
      id: true,
      invoiceNumber: true,
      invoiceDate: true,
      dateReceived: true,
      category: true,
      subtotalCents: true,
      gstCents: true,
      pstCents: true,
      shippingCents: true,
      rebateCents: true,
      totalCents: true,
      internalMemo: true,
      appliesToAllEvents: true,
      closedAt: true,
      createdAt: true,
      imageDataUrl: false,
      supplier: { select: { name: true } },
      event: { select: { name: true } },
      createdBy: { select: { name: true } },
      items: {
        select: {
          qty: true,
          unit: true,
          unitCostCents: true,
          lineTotalCents: true,
          ingredient: { select: { name: true } },
        },
        orderBy: { id: "asc" },
      },
    },
    orderBy: { invoiceDate: "desc" },
  });
}

export async function getInvoice(locationId: string, id: string) {
  return prisma.invoice.findFirst({
    where: { id, locationId },
    include: {
      supplier: true,
      location: { select: { name: true } },
      createdBy: { select: { name: true } },
      po: { select: { id: true } },
      items: { include: { ingredient: true }, orderBy: { id: "asc" } },
    },
  });
}

export async function listSuppliersForInvoice(businessId: string) {
  return prisma.supplier.findMany({
    where: { businessId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function searchIngredients(businessId: string, q: string, limit = 25) {
  const term = q.trim();
  if (!term) {
    return prisma.ingredient.findMany({
      where: { businessId },
      select: { id: true, name: true, sku: true, unit: true, category: true, lastCostCents: true, supplierId: true },
      orderBy: { name: "asc" },
      take: limit,
    });
  }
  return prisma.ingredient.findMany({
    where: {
      businessId,
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { sku: { contains: term, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, sku: true, unit: true, category: true, lastCostCents: true, supplierId: true },
    orderBy: { name: "asc" },
    take: limit,
  });
}

export async function listOpenPosForSupplier(locationId: string, supplierId: string) {
  return prisma.purchaseOrder.findMany({
    where: { locationId, supplierId, status: { in: ["SENT", "RECEIVED"] } },
    include: { items: { include: { ingredient: true } } },
    orderBy: { orderedAt: "desc" },
    take: 10,
  });
}

// Powers the dashboard's dark "Invoice tracking" card. The schema has no
// due-date column, so "overdue" isn't derivable — we report paid/open counts,
// the real open balance, and the oldest still-open bill instead of inventing
// a due date.
export async function getInvoiceTracking(locationId: string) {
  const rows = await prisma.invoice.findMany({
    where: { locationId },
    select: {
      totalCents: true,
      closedAt: true,
      invoiceDate: true,
      supplier: { select: { name: true } },
    },
    orderBy: { invoiceDate: "asc" },
  });

  const open = rows.filter((r) => !r.closedAt);
  const oldestOpen = open[0] ?? null;

  return {
    paidCount: rows.length - open.length,
    openCount: open.length,
    totalCount: rows.length,
    openBalanceCents: open.reduce((a, r) => a + r.totalCents, 0),
    oldestOpen: oldestOpen
      ? { supplier: oldestOpen.supplier.name, date: oldestOpen.invoiceDate }
      : null,
    // Newest-first paid/open flags drive the contribution-dot grid.
    recentStatuses: rows
      .slice(-48)
      .map((r) => (r.closedAt ? "paid" : "open")),
  };
}

/**
 * Open bills for the Overview's "Invoices due" panel.
 *
 * The schema has no due-date column, so a real due date can't be shown without
 * inventing one. Oldest-open-first is the honest ordering — the age of the
 * bill is what actually tells an operator which one needs paying — and the
 * caller renders "Open Nd" rather than a fabricated "Overdue Nd".
 */
export async function listOpenInvoicesDue(locationId: string, limit = 3) {
  return prisma.invoice.findMany({
    where: { locationId, closedAt: null },
    select: {
      id: true,
      invoiceNumber: true,
      invoiceDate: true,
      totalCents: true,
      appliesToAllEvents: true,
      supplier: { select: { name: true } },
      event: { select: { name: true } },
    },
    orderBy: { invoiceDate: "asc" },
    take: limit,
  });
}

/** Open-invoice count for the sidebar badge. */
export async function countOpenInvoices(locationId: string) {
  return prisma.invoice.count({ where: { locationId, closedAt: null } });
}
