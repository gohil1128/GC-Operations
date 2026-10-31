import { test, expect } from "@playwright/test";
import { signIn, expectRedirectedAwayFrom, statusOf } from "./helpers";

/*
  Who can reach what. STAFF exists to record a shift — a cash close and an
  inventory count — and must not see sales, margins, supplier prices or wages.
  Every page below hides one of those, so each one is a real confidentiality
  boundary rather than a tidy-navigation preference.
*/

const FORBIDDEN_TO_STAFF = [
  "/dashboard",
  "/reports",
  "/sales",
  "/events",
  "/purchasing",
  "/purchasing/invoices",
  "/expenses",
  "/inventory",
  "/recipes",
  "/labor",
  "/labor/employees",
  "/settings",
  "/settings/users",
  "/settings/integrations",
  "/settings/exports",
];

const ALLOWED_TO_STAFF = ["/cash", "/cash/new", "/inventory/counts"];

test.describe("staff access", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, "staff");
  });

  test("lands on cash, not a dashboard it cannot open", async ({ page }) => {
    expect(page.url()).toContain("/cash");
  });

  for (const path of FORBIDDEN_TO_STAFF) {
    test(`cannot open ${path}`, async ({ page }) => {
      await expectRedirectedAwayFrom(page, path);
    });
  }

  for (const path of ALLOWED_TO_STAFF) {
    test(`can open ${path}`, async ({ page }) => {
      const resp = await page.goto(path);
      expect(resp?.status()).toBe(200);
      expect(page.url()).toContain(path);
    });
  }

  test("cannot download an export, which would hand over what the pages hide", async ({ page }) => {
    // The export CSVs contain sales, costs and margins. A role that cannot see
    // those on screen must not be able to fetch them.
    for (const key of ["pnl", "sales", "invoices", "spend", "recipes"]) {
      const status = await statusOf(page.request, `/api/exports/${key}`);
      expect(status, `/api/exports/${key} should be refused for staff`).toBe(403);
    }
  });
});

test.describe("owner access", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, "owner");
  });

  test("can open every page staff cannot", async ({ page }) => {
    for (const path of FORBIDDEN_TO_STAFF) {
      const resp = await page.goto(path);
      expect(resp?.status(), `${path} should be open to the owner`).toBe(200);
      expect(page.url()).toContain(path);
    }
  });
});

test.describe("signed out", () => {
  test("every app page redirects to login", async ({ page }) => {
    for (const path of ["/dashboard", "/cash", "/settings", "/reports"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(page.url(), `${path} should require signing in`).toContain("/login");
    }
  });

  test("exports are refused", async ({ request }) => {
    // 403 or a redirect to the sign-in page; what matters is that no CSV comes back.
    const r = await request.get("/api/exports/pnl", { maxRedirects: 0 });
    expect(r.status()).not.toBe(200);
  });
});
