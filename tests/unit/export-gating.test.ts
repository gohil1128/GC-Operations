import { describe, it, expect } from "vitest";
import { EXPORTS, findExport } from "@/modules/exports/registry";
import { SECTIONS, SECTION_KEYS } from "@/modules/section-lock/sections";

/*
  The section PIN must cover the downloads, not just the pages.

  This existed as a hand-written map in the export route listing two of the four
  downloads that needed it, so /api/exports/recipes served every costed recipe
  while /recipes itself sat behind the PIN. The gate now lives on each export
  definition; this test is what stops the same drift happening again when
  somebody adds the fifth one.
*/

describe("export registry", () => {
  it("has unique keys", () => {
    const keys = EXPORTS.map((e) => e.key);
    expect(new Set(keys).size, `duplicate export key: ${keys.filter((k, i) => keys.indexOf(k) !== i)}`)
      .toBe(keys.length);
  });

  it("resolves every registered key", () => {
    for (const e of EXPORTS) expect(findExport(e.key)?.key).toBe(e.key);
  });

  it("returns undefined for an unknown key rather than throwing", () => {
    expect(findExport("../../etc/passwd")).toBeUndefined();
    expect(findExport("")).toBeUndefined();
  });

  it("only ever declares a section the lock actually knows about", () => {
    for (const e of EXPORTS) {
      if (e.section) {
        expect(SECTION_KEYS, `${e.key} declares unknown section ${e.section}`).toContain(e.section);
      }
    }
  });
});

/*
  The four downloads that mirror a lockable page, named explicitly. A new export
  over the same data has to be added here deliberately — which is the point.
*/
const MUST_BE_GATED: Record<string, string> = {
  pnl: "REPORTS",               // the profit & loss statement itself
  "event-summary": "EVENTS",    // per-event P&L
  events: "EVENTS",             // the event list behind /events
  recipes: "RECIPES",           // recipes with their costed bills of materials
};

describe("downloads behind the section PIN", () => {
  for (const [key, section] of Object.entries(MUST_BE_GATED)) {
    it(`${key} is gated on ${section}`, () => {
      const def = findExport(key);
      expect(def, `export "${key}" no longer exists — update this test deliberately`).toBeDefined();
      expect(def!.section).toBe(section);
    });
  }

  it("covers every lockable section that has a matching download", () => {
    // Each lockable section should have at least one gated export, or the PIN
    // protects a page whose data walks out as CSV.
    for (const s of SECTIONS) {
      const gated = EXPORTS.filter((e) => e.section === s.key);
      expect(gated.length, `no export is gated on ${s.key} (${s.label})`).toBeGreaterThan(0);
    }
  });
});
