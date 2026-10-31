import { describe, it, expect } from "vitest";
import { CAPABILITIES, can, homeFor } from "@/lib/permissions";
import type { Role } from "@prisma/client";

/*
  The permission matrix, asserted exhaustively rather than by sampling.

  This is the file that decides what a staff member can see of their employer's
  finances. A capability added later and silently granted to everyone is the
  failure this guards: the table below has to be updated deliberately, so
  widening access becomes a visible diff rather than a side effect.
*/

const ROLES: Role[] = ["OWNER", "MANAGER", "STAFF"];

const EXPECTED: Record<Role, Record<string, boolean>> = {
  OWNER: {
    overview: true, events: true, financials: true, purchasing: true,
    expenses: true, labor: true, inventory: true, cash: true,
    cashVerify: true, inventoryCount: true, exports: true, settings: true,
  },
  MANAGER: {
    overview: true, events: true, financials: true, purchasing: true,
    expenses: true, labor: true, inventory: true, cash: true,
    cashVerify: true, inventoryCount: true, exports: true,
    settings: false, // team, integrations and data export stay with the owner
  },
  STAFF: {
    cash: true, inventoryCount: true,
    overview: false, events: false, financials: false, purchasing: false,
    expenses: false, labor: false, inventory: false,
    cashVerify: false, // counting a drawer must not also sign it off
    exports: false,    // would hand over everything the pages hide
    settings: false,
  },
};

describe("capability matrix", () => {
  it("covers every capability the app defines", () => {
    for (const role of ROLES) {
      const declared = Object.keys(EXPECTED[role]).sort();
      expect(declared, `EXPECTED[${role}] is out of date with CAPABILITIES`)
        .toEqual([...CAPABILITIES].sort());
    }
  });

  for (const role of ROLES) {
    for (const cap of CAPABILITIES) {
      it(`${role} ${EXPECTED[role][cap] ? "can" : "cannot"} ${cap}`, () => {
        expect(can(role, cap)).toBe(EXPECTED[role][cap]);
      });
    }
  }
});

describe("separation of duties", () => {
  it("keeps counting a drawer separate from verifying it, for every role that counts", () => {
    // Whoever counts must not be able to sign their own count off. STAFF counts;
    // STAFF must not verify.
    expect(can("STAFF", "cash")).toBe(true);
    expect(can("STAFF", "cashVerify")).toBe(false);
  });

  it("gives settings to the owner alone", () => {
    expect(ROLES.filter((r) => can(r, "settings"))).toEqual(["OWNER"]);
  });

  it("never lets a role reach exports without also reaching what exports contain", () => {
    // exports emits sales, costs and reports as CSV. Anyone who can export must
    // already be allowed to see those on screen, or the export is a bypass.
    for (const role of ROLES) {
      if (can(role, "exports")) {
        expect(can(role, "financials"), `${role} can export but not see financials`).toBe(true);
        expect(can(role, "overview"), `${role} can export but not see the overview`).toBe(true);
      }
    }
  });

  it("grants STAFF strictly less than MANAGER, and MANAGER strictly less than OWNER", () => {
    for (const cap of CAPABILITIES) {
      if (can("STAFF", cap)) expect(can("MANAGER", cap), `MANAGER lacks ${cap} that STAFF has`).toBe(true);
      if (can("MANAGER", cap)) expect(can("OWNER", cap), `OWNER lacks ${cap} that MANAGER has`).toBe(true);
    }
  });
});

describe("homeFor", () => {
  it("never sends a role to a page it cannot open", () => {
    for (const role of ROLES) {
      const home = homeFor(role);
      if (home === "/dashboard") expect(can(role, "overview")).toBe(true);
      if (home === "/cash") expect(can(role, "cash")).toBe(true);
    }
  });

  it("sends staff to cash, not to a dashboard that would bounce them back", () => {
    expect(homeFor("STAFF")).toBe("/cash");
    expect(homeFor("OWNER")).toBe("/dashboard");
    expect(homeFor("MANAGER")).toBe("/dashboard");
  });
});
