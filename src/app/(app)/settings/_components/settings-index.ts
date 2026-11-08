/*
  Every setting the app has, in one list: where it lives and the words someone
  might type to find it. The Settings navigator groups these and searches them,
  across all four Settings pages (Business, Team, Connections, Export).
  Each `id` is the anchor of the card on its page.
*/
export type SettingsEntry = {
  id: string;
  label: string;
  hint: string;
  group: "General" | "Dashboard" | "Operations" | "Privacy" | "Team" | "Connections" | "Export" | "Danger";
  href: string;
  keywords: string;
};

export const SETTINGS: SettingsEntry[] = [
  { id: "business", label: "Business profile", hint: "Name, timezone, cost targets", group: "General", href: "/settings/business", keywords: "name timezone time zone food cost labor labour target percent" },
  { id: "business", label: "Valuation multipliers", hint: "EBITDA and revenue multiples", group: "General", href: "/settings/business", keywords: "valuation ebitda revenue multiple worth value" },
  { id: "overview-cards", label: "Overview cards", hint: "What the Home screen shows", group: "Dashboard", href: "/settings/overview-cards", keywords: "home dashboard cards hide show widgets" },
  { id: "cost-of-goods", label: "Cost of goods", hint: "Which bills count against gross margin", group: "Dashboard", href: "/settings/cost-of-goods", keywords: "cogs gross margin categories opex operating expense invoice category" },
  { id: "transparency", label: "Transparency", hint: "How see-through panels are on this device", group: "Dashboard", href: "/settings/transparency", keywords: "glass blur frosted solid contrast appearance display" },
  { id: "premix-cost", label: "Premix cost", hint: "What a bag costs to make", group: "Operations", href: "/settings/premix-cost", keywords: "premix bag cost make in house profit margin price" },
  { id: "locations", label: "Locations", hint: "Stores and event channels", group: "Operations", href: "/settings/locations", keywords: "location store cafe address channel" },
  { id: "events", label: "Events", hint: "Markets, dates and fees", group: "Operations", href: "/settings/events", keywords: "event market festival fee dates colour color" },
  { id: "pin-lock", label: "My PIN lock", hint: "Hide P&L, events or recipes on your screen", group: "Privacy", href: "/settings/pin-lock", keywords: "pin lock password privacy hide profit loss recipes" },
  { id: "team", label: "Team members", hint: "Invite people, roles and access", group: "Team", href: "/settings/users", keywords: "users team staff manager owner invite role access join requests approve google" },
  { id: "ai", label: "AI invoice reading", hint: "Turn the Anthropic API on or off", group: "Connections", href: "/settings/ai", keywords: "ai anthropic claude api scan gmail email invoices read automatic off on toggle privacy" },
  { id: "square", label: "Square sales", hint: "Live sales sync", group: "Connections", href: "/settings/square", keywords: "square pos sales sync connect" },
  { id: "email-invoices", label: "Email invoices", hint: "Read supplier bills from Gmail", group: "Connections", href: "/settings/email-invoices", keywords: "gmail email invoices scan ai inbox" },
  { id: "sales-summary-csv", label: "Sales Summary CSV", hint: "Upload a day's Square summary", group: "Connections", href: "/settings/sales-summary-csv", keywords: "csv upload import square sales summary" },
  { id: "item-sales-csv", label: "Item Sales CSV", hint: "Upload what sold", group: "Connections", href: "/settings/item-sales-csv", keywords: "csv upload import items sold square" },
  { id: "imported-data", label: "Imported data", hint: "Delete imported sales days", group: "Connections", href: "/settings/imported-data", keywords: "delete imported days wipe sales data" },
  { id: "items-categories", label: "Items & categories", hint: "Sort Square items, link recipes", group: "Connections", href: "/settings/items-categories", keywords: "items categories premix recipe link categorize" },
  { id: "exports", label: "Data export", hint: "Download CSVs of everything", group: "Export", href: "/settings/exports", keywords: "export download csv backup spreadsheet" },
  { id: "danger-zone", label: "Danger zone", hint: "Wipe demo or operational data", group: "Danger", href: "/settings/danger-zone", keywords: "delete wipe reset danger demo data" },
];

export const GROUPS: SettingsEntry["group"][] = ["General", "Dashboard", "Operations", "Privacy", "Team", "Connections", "Export", "Danger"];
