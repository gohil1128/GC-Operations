import type { Scope } from "@/lib/scope";
import type { SectionKey } from "@/modules/section-lock/sections";
import { fromCents } from "@/lib/money";
import { dailySummary, weeklyTrend, purchaseSpendByPeriod, pnlByEvent } from "@/modules/reports/queries";
import { getLaborReport } from "@/modules/labor/queries";
import { getVarianceReport, listIngredients } from "@/modules/inventory/queries";
import { listCashCloses, listPayouts } from "@/modules/cash/queries";
import { listInvoicesForExport, type InvoiceFilters } from "@/modules/invoices/queries";
import { listCapitalAssets, depreciationForPeriod } from "@/modules/capital/queries";
import { listExpenses, EXPENSE_CATEGORIES } from "@/modules/expenses/queries";
import { listVendors } from "@/modules/vendors/queries";
import { getEventDetail } from "@/modules/events/detail";
import { getActiveEvent } from "@/modules/events/queries";
import {
  listDailySalesForExport,
  listSalesItemsForExport,
  listPurchaseOrderItemsForExport,
  listRecipeLinesForExport,
  listInventoryCountLinesForExport,
  listEmployeesForExport,
  listEventsForExport,
} from "./queries";

export type ExportGroup = "Sales" | "Purchasing" | "Money" | "Inventory" | "Labor" | "Reference";

export type ExportResult = { columns: string[]; rows: Record<string, unknown>[] };

export type ExportContext = { scope: Scope; sp: URLSearchParams };

export type ExportDef = {
  key: string;
  label: string;
  /** One line shown under the label on the export page. */
  description: string;
  group: ExportGroup;
  /*
    The lockable section this download belongs to, if any.

    Declared here, beside the builder, rather than in a lookup table over in the
    route. That table listed two of the four exports that needed it, so
    /api/exports/recipes handed over every costed recipe while /recipes itself
    sat behind the PIN, and /api/exports/events did the same. Removing a button
    is not protection when the URL is guessable, and a second list that has to
    be updated by hand every time an export is added will drift again.
  */
  section?: SectionKey;
  build: (ctx: ExportContext) => Promise<ExportResult>;
};

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
const money = (cents: number) => fromCents(cents).toFixed(2);

const EXPENSE_LABEL = new Map(EXPENSE_CATEGORIES.map((c) => [c.value, c.label]));

// Mirrors the invoice list page's own resolution: an explicit ?event= (a real
// id, or the "all" sentinel for "ignore the header's active event") wins;
// absent, the page defers to whatever event the header switcher's cookie has
// active. Without this fallback the CSV silently exported more rows than the
// screen showed whenever a cookie-scoped event was active and the list's own
// filter bar was left untouched — the export claims to match what's on
// screen, so it has to resolve the cookie the same way the page does.
function resolveEventFilter(sp: URLSearchParams, activeEventId: string | null): string | null {
  const raw = sp.get("event");
  if (raw === "all") return null;
  if (raw) return raw;
  return activeEventId;
}

// Mirrors the invoice list page's query params so a filtered view downloads
// exactly the rows on screen.
function invoiceFiltersFrom(sp: URLSearchParams, activeEventId: string | null): InvoiceFilters {
  const status = sp.get("status");
  return {
    supplierId: sp.get("supplier") ?? undefined,
    eventId: resolveEventFilter(sp, activeEventId),
    invoiceNumber: sp.get("number") ?? undefined,
    status: status === "open" || status === "closed" ? status : "all",
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
  };
}

// The invoice list narrows to event-untagged rows in JS rather than SQL;
// mirror that here so the export matches the filtered view.
function applyUntagged<T extends { event: unknown; appliesToAllEvents: boolean }>(
  rows: T[],
  sp: URLSearchParams,
): T[] {
  if (sp.get("untagged") !== "1") return rows;
  return rows.filter((r) => !r.event && !r.appliesToAllEvents);
}

export const EXPORTS: ExportDef[] = [
  // ─────────────────────────── Sales ───────────────────────────
  {
    key: "sales",
    label: "Daily sales",
    description: "Every sales day: net sales, tax, tips, transactions, source.",
    group: "Sales",
    build: async ({ scope }) => {
      const data = await listDailySalesForExport(scope.locationId);
      return {
        columns: ["date", "netSales", "tax", "tips", "transactions", "source", "event"],
        rows: data.map((s) => ({
          date: iso(s.businessDate),
          netSales: money(s.netSalesCents),
          tax: money(s.taxCents),
          tips: money(s.tipsCents),
          transactions: s.guestCount,
          source: s.source,
          event: s.event?.name ?? "",
        })),
      };
    },
  },
  {
    key: "sales-items",
    label: "Item sales",
    description: "Per-item sales lines from the Square item CSV — qty, revenue, tax.",
    group: "Sales",
    build: async ({ scope }) => {
      const data = await listSalesItemsForExport(scope.locationId);
      return {
        columns: ["date", "item", "category", "qty", "netSales", "tax", "transactions", "event"],
        rows: data.map((i) => ({
          date: iso(i.businessDate),
          item: i.itemName,
          category: i.category ?? "",
          qty: i.qty,
          netSales: money(i.netSalesCents),
          tax: money(i.taxCents),
          transactions: i.txCount,
          event: i.event?.name ?? "",
        })),
      };
    },
  },
  {
    key: "daily",
    label: "Daily summary (last 30 days)",
    description: "Sales with food cost, labor cost and cash over/short per day.",
    group: "Sales",
    build: async ({ scope }) => {
      const data = await dailySummary(scope.locationId, 30);
      return {
        columns: ["date", "netSales", "tips", "guests", "foodCost", "foodPct", "laborCost", "laborPct", "cashOverShort"],
        rows: data.map((r) => ({
          date: r.date,
          netSales: money(r.netSalesCents),
          tips: money(r.tipsCents),
          guests: r.guests,
          foodCost: money(r.foodCostCents),
          foodPct: r.foodPct.toFixed(2),
          laborCost: money(r.laborCostCents),
          laborPct: r.laborPct.toFixed(2),
          cashOverShort: money(r.cashOverShortCents),
        })),
      };
    },
  },
  {
    key: "weekly",
    label: "Weekly trend (last 4 weeks)",
    description: "Net sales, food % and labor % rolled up by week.",
    group: "Sales",
    build: async ({ scope }) => {
      const data = await weeklyTrend(scope.locationId, 4);
      return {
        columns: ["week", "from", "to", "netSales", "foodPct", "laborPct"],
        rows: data.map((w) => ({
          week: w.label,
          from: w.from,
          to: w.to,
          netSales: money(w.netSalesCents),
          foodPct: w.foodPct.toFixed(2),
          laborPct: w.laborPct.toFixed(2),
        })),
      };
    },
  },
  {
    key: "pnl",
    section: "REPORTS",
    label: "Profit & loss by event",
    description: "The P&L matrix: sales, COGS, labor, expenses, fees, profit per event.",
    group: "Sales",
    build: async ({ scope }) => {
      const cols = await pnlByEvent(scope.businessId, scope.locationId);
      return {
        columns: [
          "column", "transactions", "netSales", "costOfGoods", "grossProfit",
          "grossMarginPct", "labor", "operatingExpenses", "eventFees", "profit",
          "marginPct", "tips",
        ],
        rows: cols.map((c) => ({
          column: c.key === "overall" ? "Overall" : c.name,
          transactions: c.txns,
          netSales: money(c.netSalesCents),
          costOfGoods: money(c.cogsCents),
          grossProfit: money(c.grossProfitCents),
          grossMarginPct: c.netSalesCents > 0 ? c.grossMarginPct.toFixed(2) : "",
          labor: money(c.laborCents),
          operatingExpenses: money(c.opexCents),
          eventFees: money(c.feeCents),
          profit: money(c.profitCents),
          marginPct: c.netSalesCents > 0 ? c.marginPct.toFixed(2) : "",
          tips: money(c.tipsCents),
        })),
      };
    },
  },

  // ───────────────────────── Purchasing ─────────────────────────
  {
    key: "invoices",
    label: "Invoices",
    description: "One row per supplier bill, with the full tax and adjustment breakdown.",
    group: "Purchasing",
    build: async ({ scope, sp }) => {
      const activeEvent = await getActiveEvent(scope.businessId);
      const data = applyUntagged(
        await listInvoicesForExport(scope.locationId, invoiceFiltersFrom(sp, activeEvent?.id ?? null)),
        sp,
      );
      return {
        columns: [
          "invoiceNumber", "supplier", "event", "category", "invoiceDate", "dateReceived",
          "itemCount", "subtotal", "gst", "pst", "shipping", "rebate", "total",
          "status", "closedAt", "createdBy", "memo",
        ],
        rows: data.map((i) => ({
          invoiceNumber: i.invoiceNumber,
          supplier: i.supplier.name,
          event: i.appliesToAllEvents ? "All events" : (i.event?.name ?? ""),
          category: i.category ?? "",
          invoiceDate: iso(i.invoiceDate),
          dateReceived: iso(i.dateReceived),
          itemCount: i.items.length,
          subtotal: money(i.subtotalCents),
          gst: money(i.gstCents),
          pst: money(i.pstCents),
          shipping: money(i.shippingCents),
          rebate: money(i.rebateCents),
          total: money(i.totalCents),
          status: i.closedAt ? "Closed" : "Open",
          closedAt: iso(i.closedAt),
          createdBy: i.createdBy.name,
          memo: i.internalMemo ?? "",
        })),
      };
    },
  },
  {
    key: "invoice-items",
    label: "Invoice line items",
    description: "One row per invoice item, carrying its invoice's columns for pivoting.",
    group: "Purchasing",
    build: async ({ scope, sp }) => {
      const activeEvent = await getActiveEvent(scope.businessId);
      const data = applyUntagged(
        await listInvoicesForExport(scope.locationId, invoiceFiltersFrom(sp, activeEvent?.id ?? null)),
        sp,
      );
      return {
        columns: [
          "invoiceNumber", "supplier", "event", "category", "invoiceDate",
          "ingredient", "qty", "unit", "unitCost", "lineTotal", "status",
        ],
        rows: data.flatMap((i) =>
          i.items.map((it) => ({
            invoiceNumber: i.invoiceNumber,
            supplier: i.supplier.name,
            event: i.appliesToAllEvents ? "All events" : (i.event?.name ?? ""),
            category: i.category ?? "",
            invoiceDate: iso(i.invoiceDate),
            ingredient: it.ingredient.name,
            qty: it.qty,
            unit: it.unit,
            unitCost: money(it.unitCostCents),
            lineTotal: money(it.lineTotalCents),
            status: i.closedAt ? "Closed" : "Open",
          })),
        ),
      };
    },
  },
  {
    key: "purchase-orders",
    label: "Purchase orders",
    description: "One row per PO line: supplier, status, dates, item, qty and cost.",
    group: "Purchasing",
    build: async ({ scope }) => {
      const data = await listPurchaseOrderItemsForExport(scope.locationId);
      return {
        columns: [
          "poId", "supplier", "status", "orderedAt", "expectedAt", "receivedAt",
          "ingredient", "qtyOrdered", "qtyReceived", "unit", "unitCost", "lineTotal", "poTotal",
        ],
        rows: data.flatMap((po): Record<string, unknown>[] => {
          const header = {
            poId: po.id,
            supplier: po.supplier.name,
            status: po.status,
            orderedAt: iso(po.orderedAt),
            expectedAt: iso(po.expectedAt),
            receivedAt: iso(po.receivedAt),
            poTotal: money(po.totalCents),
          };
          // A PO with no lines still deserves a row, or it vanishes silently.
          if (po.items.length === 0) {
            return [{ ...header, ingredient: "", qtyOrdered: "", qtyReceived: "", unit: "", unitCost: "", lineTotal: "" }];
          }
          return po.items.map((it) => ({
            ...header,
            ingredient: it.ingredient.name,
            qtyOrdered: it.qtyOrdered,
            qtyReceived: it.qtyReceived,
            unit: it.unit,
            unitCost: money(it.unitCostCents),
            lineTotal: money(it.lineTotalCents),
          }));
        }),
      };
    },
  },
  {
    key: "spend",
    label: "Supplier spend (last 30 days)",
    description: "Total spend and order count per supplier.",
    group: "Purchasing",
    build: async ({ scope }) => {
      const data = await purchaseSpendByPeriod(scope.locationId, 30);
      return {
        columns: ["supplier", "orders", "spend"],
        rows: data.map((r) => ({ supplier: r.name, orders: r.orderCount, spend: money(r.spendCents) })),
      };
    },
  },

  // ─────────────────────────── Money ───────────────────────────
  {
    key: "capital",
    label: "Capital equipment (capex)",
    description: "Equipment purchases with depreciation to date and net book value.",
    group: "Money",
    build: async ({ scope }) => {
      const assets = await listCapitalAssets(scope.locationId);
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
      return {
        columns: [
          "name", "category", "vendor", "event", "purchaseDate", "purchasePrice",
          "usefulLifeMonths", "salvageValue", "monthlyDepreciation",
          "depreciationToDate", "netBookValue", "status", "notes",
        ],
        rows: assets.map((a) => {
          const monthlyDep = depreciationForPeriod(a, monthStart, monthEnd);
          const cumDep = depreciationForPeriod(a, a.purchaseDate, today);
          const nbv = Math.max(a.salvageValueCents, a.purchasePriceCents - cumDep);
          return {
            name: a.name,
            category: a.category ?? "",
            vendor: a.vendor ?? "",
            event: a.event?.name ?? "",
            purchaseDate: iso(a.purchaseDate),
            purchasePrice: money(a.purchasePriceCents),
            usefulLifeMonths: a.usefulLifeMonths ?? "",
            salvageValue: money(a.salvageValueCents),
            monthlyDepreciation: money(monthlyDep),
            depreciationToDate: money(cumDep),
            netBookValue: money(nbv),
            status: a.status,
            notes: a.notes ?? "",
          };
        }),
      };
    },
  },
  {
    key: "expenses",
    label: "Operating expenses",
    description: "Every logged expense with category, vendor and event tag.",
    group: "Money",
    build: async ({ scope }) => {
      const data = await listExpenses(scope.locationId);
      return {
        columns: ["date", "category", "description", "vendor", "event", "amount", "isIncentive", "createdBy"],
        rows: data.map((e) => ({
          date: iso(e.businessDate),
          category: EXPENSE_LABEL.get(e.category) ?? e.category,
          description: e.description ?? "",
          vendor: e.vendor?.name ?? "",
          event: e.event?.name ?? "",
          amount: money(e.amountCents),
          isIncentive: e.isIncentive ? "yes" : "no",
          createdBy: e.createdBy.name,
        })),
      };
    },
  },
  {
    key: "cash",
    label: "Cash closes",
    description: "Daily drawer counts: opening, closing, deposit, expected, over/short.",
    group: "Money",
    build: async ({ scope }) => {
      const data = await listCashCloses(scope.locationId, 365);
      return {
        columns: ["date", "opening", "closing", "deposit", "paidIn", "paidOut", "expected", "overShort", "closedBy"],
        rows: data.map((c) => ({
          date: iso(c.businessDate),
          opening: money(c.openingCents),
          closing: money(c.closingCents),
          deposit: money(c.depositCents),
          paidIn: money(c.paidInCents),
          paidOut: money(c.paidOutCents),
          expected: money(c.expectedCents),
          overShort: money(c.overShortCents),
          closedBy: c.closedBy.name,
        })),
      };
    },
  },
  {
    key: "payouts",
    label: "Cash payouts",
    description: "Cash taken out of the drawer — what for, who took it, and the receipt.",
    group: "Money",
    build: async ({ scope }) => {
      const data = await listPayouts(scope.locationId, 365);
      return {
        columns: ["date", "amount", "type", "reason", "paidTo", "reference"],
        rows: data.map((p) => ({
          date: iso(p.businessDate),
          amount: money(p.amountCents),
          type: p.kind,
          reason: p.reason,
          paidTo: p.paidTo ?? "",
          reference: p.reference ?? "",
        })),
      };
    },
  },
  {
    key: "vendors",
    label: "Vendors",
    description: "Contractors and recurring vendors with monthly fees.",
    group: "Money",
    build: async ({ scope }) => {
      const data = await listVendors(scope.businessId);
      return {
        columns: ["name", "role", "country", "monthlyFee", "currency", "defaultCategory", "flatFee", "active", "notes"],
        rows: data.map((v) => ({
          name: v.name,
          role: v.role ?? "",
          country: v.country ?? "",
          monthlyFee: money(v.monthlyFeeCents),
          currency: v.currency,
          defaultCategory: EXPENSE_LABEL.get(v.defaultCategory) ?? v.defaultCategory,
          flatFee: v.isFlatFee ? "yes" : "no",
          active: v.isActive ? "yes" : "no",
          notes: v.notes ?? "",
        })),
      };
    },
  },

  // ───────────────────────── Inventory ─────────────────────────
  {
    key: "ingredients",
    label: "Ingredients",
    description: "Full catalog with on-hand quantity, unit, costs and par levels.",
    group: "Inventory",
    build: async ({ scope }) => {
      const data = await listIngredients(scope.businessId);
      return {
        columns: [
          "name", "sku", "category", "unit", "onHand", "parLevel", "reorderPoint",
          "reorderQty", "lastCost", "avgCost", "onHandValue", "supplier",
        ],
        rows: data.map((i) => ({
          name: i.name,
          sku: i.sku ?? "",
          category: i.category ?? "",
          unit: i.unit,
          onHand: i.onHand,
          parLevel: i.parLevel,
          reorderPoint: i.reorderPoint,
          reorderQty: i.reorderQty,
          lastCost: money(i.lastCostCents),
          avgCost: money(i.avgCostCents),
          onHandValue: money(Math.round(i.onHand * i.avgCostCents)),
          supplier: i.supplier?.name ?? "",
        })),
      };
    },
  },
  {
    key: "inventory-counts",
    label: "Inventory counts",
    description: "One row per counted line: counted vs theoretical, with variance cost.",
    group: "Inventory",
    build: async ({ scope }) => {
      const data = await listInventoryCountLinesForExport(scope.locationId);
      return {
        columns: [
          "countedAt", "type", "countedBy", "ingredient", "unit",
          "qtyCounted", "theoreticalQty", "varianceQty", "varianceCost", "notes",
        ],
        rows: data.flatMap((c) =>
          c.lines.map((l) => ({
            countedAt: iso(c.countedAt),
            type: c.type,
            countedBy: c.countedBy.name,
            ingredient: l.ingredient.name,
            unit: l.unit,
            qtyCounted: l.qtyCounted,
            theoreticalQty: l.theoreticalQty,
            varianceQty: l.varianceQty,
            varianceCost: money(l.varianceCostCents),
            notes: c.notes ?? "",
          })),
        ),
      };
    },
  },
  {
    key: "variance",
    label: "Variance (latest count)",
    description: "Theoretical vs actual usage on the most recent count.",
    group: "Inventory",
    build: async ({ scope }) => {
      const v = await getVarianceReport(scope.locationId);
      return {
        columns: ["ingredient", "unit", "theoretical", "actual", "variance", "variancePct", "varianceCost"],
        rows: (v?.lines ?? []).map((l) => ({
          ingredient: l.ingredient,
          unit: l.unit,
          theoretical: l.theoretical.toFixed(3),
          actual: l.actual.toFixed(3),
          variance: l.variance.toFixed(3),
          variancePct: l.pct.toFixed(2),
          varianceCost: money(l.varianceCostCents),
        })),
      };
    },
  },
  {
    key: "recipes",
    section: "RECIPES",
    label: "Recipes",
    description: "One row per recipe ingredient, with menu price and line cost.",
    group: "Inventory",
    build: async ({ scope }) => {
      const data = await listRecipeLinesForExport(scope.businessId);
      return {
        columns: [
          "recipe", "category", "menuPrice", "yieldQty", "yieldUnit", "active",
          "ingredient", "qty", "unit", "ingredientAvgCost",
        ],
        rows: data.flatMap((r): Record<string, unknown>[] => {
          const header = {
            recipe: r.name,
            category: r.category ?? "",
            menuPrice: money(r.menuPriceCents),
            yieldQty: r.yieldQty,
            yieldUnit: r.yieldUnit,
            active: r.isActive ? "yes" : "no",
          };
          // Keep recipes with no BOM visible rather than dropping them.
          if (r.ingredients.length === 0) {
            return [{ ...header, ingredient: "", qty: "", unit: "", ingredientAvgCost: "" }];
          }
          return r.ingredients.map((ri) => ({
            ...header,
            ingredient: ri.ingredient.name,
            qty: ri.qty,
            unit: ri.unit,
            ingredientAvgCost: money(ri.ingredient.avgCostCents),
          }));
        }),
      };
    },
  },

  // ─────────────────────────── Labor ───────────────────────────
  {
    key: "labor",
    label: "Labor report (last 14 days)",
    description: "Scheduled vs actual hours and cost per employee.",
    group: "Labor",
    build: async ({ scope }) => {
      const data = await getLaborReport(scope.locationId, 14);
      return {
        columns: ["employee", "position", "wage", "scheduledHours", "actualHours", "cost"],
        rows: data.byEmployee.map((e) => ({
          employee: e.name,
          position: e.position,
          wage: money(e.rate),
          scheduledHours: (e.scheduledMin / 60).toFixed(2),
          actualHours: (e.actualMin / 60).toFixed(2),
          cost: money(e.costCents),
        })),
      };
    },
  },
  {
    key: "employees",
    label: "Employees",
    description: "Staff roster with position, hourly rate and active status.",
    group: "Labor",
    build: async ({ scope }) => {
      const data = await listEmployeesForExport(scope.businessId);
      return {
        columns: ["name", "position", "hourlyRate", "active", "addedOn"],
        rows: data.map((e) => ({
          name: e.name,
          position: e.position,
          hourlyRate: money(e.hourlyRateCents),
          active: e.isActive ? "yes" : "no",
          addedOn: iso(e.createdAt),
        })),
      };
    },
  },

  {
    key: "event-summary",
    section: "EVENTS",
    label: "One event, end to end",
    description:
      "Everything tagged to a single event as one ledger — sales, items, invoices, expenses, labor, cash and equipment. Needs ?event=<id>.",
    group: "Sales",
    build: async ({ scope, sp }) => {
      const columns = ["section", "date", "description", "reference", "quantity", "amount"];
      const eventId = sp.get("event");
      if (!eventId) return { columns, rows: [] };
      const d = await getEventDetail(scope.businessId, scope.locationId, eventId);
      if (!d) return { columns, rows: [] };

      // One flat ledger rather than seven files: a single CSV pivots.
      const row = (
        section: string,
        date: Date | null,
        description: string,
        reference = "",
        quantity: number | string = "",
        amountCents: number | null = null,
      ) => ({
        section,
        date: iso(date),
        description,
        reference,
        quantity,
        amount: amountCents === null ? "" : money(amountCents),
      });

      return {
        columns,
        rows: [
          row("Event", d.event.startDate, d.event.name, d.event.feeNote ?? "", "", d.event.feeCents),
          ...d.sales.map((s2) =>
            row("Daily sales", s2.businessDate, "Net sales", s2.source, s2.guestCount, s2.netSalesCents),
          ),
          ...d.sales
            .filter((s2) => s2.tipsCents !== 0)
            .map((s2) => row("Tips", s2.businessDate, "Tips", s2.source, "", s2.tipsCents)),
          ...d.items.map((i) =>
            row("Items sold", null, i.itemName, i.category ?? "", i.qty, i.netSalesCents),
          ),
          ...d.invoices.map((inv) =>
            row(
              "Invoices",
              inv.invoiceDate,
              inv.supplier.name,
              inv.invoiceNumber ?? "",
              inv._count.items,
              inv.totalCents,
            ),
          ),
          ...d.shared.invoices.map((inv) =>
            row(
              "Shared invoices (this event's share)",
              inv.invoiceDate,
              inv.supplier.name,
              `${inv.invoiceNumber ?? ""} · 1/${d.shared.shareDiv}`,
              "",
              Math.round(inv.totalCents / d.shared.shareDiv),
            ),
          ),
          ...d.expenses.map((e) =>
            row(
              "Operating expenses",
              e.businessDate,
              EXPENSE_LABEL.get(e.category) ?? e.category,
              e.vendor?.name ?? "",
              "",
              e.amountCents,
            ),
          ),
          ...d.labor.map((l) =>
            row(
              "Labor (worked inside the event's dates)",
              l.start,
              l.employee,
              l.actual ? "clocked" : "scheduled",
              (l.minutes / 60).toFixed(2),
              l.costCents,
            ),
          ),
          ...d.cashCloses.map((c) =>
            row("Cash closes", c.businessDate, "Over / short", "", "", c.overShortCents),
          ),
          ...d.assets.map((a) =>
            row("Equipment (capital, not in P&L)", a.purchaseDate, a.name, a.vendor ?? "", "", a.purchasePriceCents),
          ),
        ],
      };
    },
  },

  // ───────────────────────── Reference ─────────────────────────
  {
    key: "events",
    section: "EVENTS",
    label: "Events",
    description: "Every event with its date range and booth fee.",
    group: "Reference",
    build: async ({ scope }) => {
      const data = await listEventsForExport(scope.businessId);
      return {
        columns: ["name", "startDate", "endDate", "fee", "feeNote", "active", "notes"],
        rows: data.map((e) => ({
          name: e.name,
          startDate: iso(e.startDate),
          endDate: iso(e.endDate),
          fee: money(e.feeCents),
          feeNote: e.feeNote ?? "",
          active: e.isActive ? "yes" : "no",
          notes: e.notes ?? "",
        })),
      };
    },
  },
];

export const EXPORT_GROUPS: ExportGroup[] = ["Sales", "Purchasing", "Money", "Inventory", "Labor", "Reference"];

export function findExport(key: string): ExportDef | undefined {
  return EXPORTS.find((e) => e.key === key);
}
