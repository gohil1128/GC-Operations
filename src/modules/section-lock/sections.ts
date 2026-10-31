/*
  Plain constants for the section lock. Kept out of actions.ts because a
  "use server" module may only export async functions — a const array there is
  a build error, not a lint nit.
*/
export const SECTIONS = [
  { key: "REPORTS", label: "Profit & loss", href: "/reports" },
  { key: "EVENTS", label: "Events", href: "/events" },
  { key: "RECIPES", label: "Recipes", href: "/recipes" },
] as const;

export type SectionKey = (typeof SECTIONS)[number]["key"];

export const SECTION_KEYS: readonly string[] = SECTIONS.map((s) => s.key);

/** How long an unlock lasts before every locked section closes again. */
export const UNLOCK_TTL_MINUTES = 60;
