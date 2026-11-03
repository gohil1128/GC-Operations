import type { Role } from "@prisma/client";

/*
  The one place that decides what each role may reach.

  Every gate goes through can() rather than testing the role directly. With two
  roles, `role === "OWNER"` doubled as "may they do this" and read as correct;
  with three it silently hands a STAFF member everything a MANAGER has, and it
  still reads as correct at the call site. That is the mistake this file exists
  to make impossible.
*/

export const CAPABILITIES = [
  "overview", // /dashboard — sales, food %, labor %, prime %
  "events", // /events — per-event P&L
  "financials", // /reports — the profit & loss statement
  "purchasing", // /purchasing, /purchasing/invoices — supplier prices, bills
  "expenses", // /expenses — operating spend, capital purchases
  "labor", // /labor — schedule, employees, wages
  "inventory", // /inventory, /inventory/variance, /recipes — on-hand value, plate costs
  "cash", // /cash — the shift cash close
  // Signing off somebody else's count. Deliberately separate from "cash":
  // the schema keeps closedBy and verifiedBy apart on purpose, and letting
  // whoever counted the drawer also verify it removes the only check there is.
  "cashVerify",
  "inventoryCount", // /inventory/counts — recording a count
  "exports", // /api/exports/* — CSV and PDF of everything above
  "settings", // /settings/* — team, integrations, business, data export
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const BY_ROLE: Record<Role, readonly Capability[]> = {
  // Everything, including the team and the business itself.
  OWNER: CAPABILITIES,

  // Runs the day to day with the same reach as the owner, except Settings —
  // team, integrations and data export stay with the owner. This is exactly
  // what a manager could already do before the third role existed, so adding
  // STAFF does not quietly change anyone's access.
  MANAGER: CAPABILITIES.filter((c) => c !== "settings"),

  // Records what happens on a shift, and nothing else: the cash close and the
  // inventory count. No sales, margins, supplier prices, wages, or reports —
  // and no exports, which would otherwise hand over everything the pages hide.
  STAFF: ["cash", "inventoryCount"],
};

export function can(role: Role, capability: Capability): boolean {
  return BY_ROLE[role].includes(capability);
}

/*
  Where a role lands, and where it gets sent when it reaches something it may
  not see. STAFF cannot open the dashboard, so the app's usual "send them to
  /dashboard" would put a staff member in a redirect loop against their own
  home page.
*/
export function homeFor(role: Role): string {
  return can(role, "overview") ? "/dashboard" : "/cash";
}

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  STAFF: "Staff",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  OWNER: "Full access, including the team and business settings.",
  MANAGER: "Everything day to day — invoices, cash, inventory, labor, reports. No settings.",
  STAFF: "Records cash closes and inventory counts only. Sees no sales, costs or reports.",
};
