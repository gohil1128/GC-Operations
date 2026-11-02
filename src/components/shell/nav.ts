import {
  LayoutDashboard, TrendingUp, Wallet, FileText, Boxes, Users, Receipt,
  Settings as SettingsIcon, CalendarDays, ShoppingBag,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { can, type Capability } from "@/lib/permissions";

/*
  The phone's navigation, as hubs.

  The More sheet used to list fourteen pages one by one (Counts, Ingredients,
  Variance, Recipes, Schedule, Labor report, Employees, four kinds of
  settings…). Most of those are the same job seen from different angles, so
  they are grouped: a hub is one tile in the sheet, and the pages inside it
  are a small tab strip at the top of the section (SectionTabs). Every page is
  still one tap from wherever you are in its section.

  Ordered most important first. The bottom bar takes the first four hubs the
  role can reach; the rest go behind "More".
*/

export type NavPage = { href: string; label: string; cap: Capability };
export type NavHub = { key: string; label: string; icon: typeof Wallet; pages: NavPage[] };

export const HUBS: NavHub[] = [
  { key: "home", label: "Home", icon: LayoutDashboard, pages: [{ href: "/dashboard", label: "Home", cap: "overview" }] },
  { key: "events", label: "Events", icon: CalendarDays, pages: [{ href: "/events", label: "Events", cap: "events" }] },
  { key: "reports", label: "Reports", icon: TrendingUp, pages: [{ href: "/reports", label: "Reports", cap: "financials" }] },
  { key: "invoices", label: "Invoices", icon: FileText, pages: [{ href: "/purchasing/invoices", label: "Invoices", cap: "purchasing" }] },
  { key: "sales", label: "Sales", icon: ShoppingBag, pages: [{ href: "/sales", label: "Sales", cap: "financials" }] },
  { key: "cash", label: "Cash", icon: Wallet, pages: [{ href: "/cash", label: "Cash closes", cap: "cash" }] },
  { key: "expenses", label: "Expenses", icon: Receipt, pages: [{ href: "/expenses", label: "Expenses", cap: "expenses" }] },
  {
    key: "stock", label: "Stock", icon: Boxes, pages: [
      { href: "/inventory", label: "Ingredients", cap: "inventory" },
      { href: "/recipes", label: "Recipes", cap: "inventory" },
      { href: "/inventory/counts", label: "Counts", cap: "inventoryCount" },
      { href: "/inventory/variance", label: "Variance", cap: "inventory" },
    ],
  },
  {
    key: "staff", label: "Staff", icon: Users, pages: [
      { href: "/labor", label: "Schedule", cap: "labor" },
      { href: "/labor/employees", label: "People", cap: "labor" },
      { href: "/labor/report", label: "Hours", cap: "labor" },
    ],
  },
  {
    key: "settings", label: "Settings", icon: SettingsIcon, pages: [
      { href: "/settings", label: "Business", cap: "settings" },
      { href: "/settings/users", label: "Team", cap: "settings" },
      { href: "/settings/integrations", label: "Connections", cap: "settings" },
      { href: "/settings/exports", label: "Export", cap: "settings" },
    ],
  },
  /*
    Purchase orders stay hidden, not deleted: a pop-up logs invoices rather
    than raising POs. The routes and every existing PO are untouched.
  */
];

/** The hubs a role can reach, each holding only the pages it can open. */
export function hubsFor(role: Role): (NavHub & { href: string })[] {
  return HUBS.map((h) => ({ ...h, pages: h.pages.filter((p) => can(role, p.cap)) }))
    .filter((h) => h.pages.length > 0)
    .map((h) => ({ ...h, href: h.pages[0].href }));
}

export const onPath = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");

/** The single page that best matches a path: the longest href it sits under. */
export function bestPage(pathname: string, pages: NavPage[]): NavPage | undefined {
  return pages.filter((p) => onPath(pathname, p.href)).sort((a, b) => b.href.length - a.href.length)[0];
}
