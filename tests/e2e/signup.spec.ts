import { test, expect } from "@playwright/test";

/*
  Self-serve signup: the path that decides whether a second customer can exist
  at all. Before this, a business could only be created by hand-written SQL.

  Runs unauthenticated and in a non-UTC timezone on purpose. The browser's zone
  is what the form sends, and getting it wrong files an evening market's takings
  under the next day.
*/

test.use({ storageState: { cookies: [], origins: [] }, timezoneId: "America/Vancouver" });

const unique = () => `founder-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;

test.describe("a new business can sign itself up", () => {
  test("signup is reachable without an account", async ({ page }) => {
    const resp = await page.goto("/signup");
    expect(resp?.status()).toBe(200);
    expect(page.url()).toContain("/signup");
  });

  /*
    One signup, then everything that should be true of a brand-new tenant.

    Deliberately not split into two tests. Signup is rate limited per address —
    five an hour — and a suite that creates a business per assertion throttles
    itself, which is how this file first failed: the limiter worked, and the
    tests read it as a product bug.
  */
  test("provisions the tenant and every page works with zero data", async ({ page }) => {
    await page.goto("/signup");
    await page.fill("#businessName", "Harbourfront Chai");
    await page.fill("#name", "Sam Okafor");
    await page.fill("#email", unique());
    await page.fill("#password", "a-long-enough-password");
    await page.click("button[type=submit]");
    await page.waitForURL(/\/dashboard/, { timeout: 40_000 });

    // Scoped to their OWN business, not the seeded one.
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toContainText("Harbourfront Chai");
    // And the timezone came from the browser, not the server.
    await expect(page.locator("#biz-tz")).toHaveValue("America/Vancouver");

    /*
      Every route with nothing recorded anywhere. This is the first thing a
      customer sees, and a division by zero or a stray "undefined" on day one is
      the impression they keep.
    */
    for (const path of [
      "/dashboard", "/cash", "/cash/new", "/events", "/sales", "/reports",
      "/expenses", "/purchasing", "/purchasing/invoices", "/inventory",
      "/inventory/counts", "/inventory/variance", "/recipes", "/labor",
      "/labor/employees", "/labor/report", "/settings", "/settings/users",
      "/settings/integrations", "/settings/exports",
    ]) {
      const resp = await page.goto(path, { waitUntil: "networkidle" });
      expect(resp?.status(), `${path} did not render`).toBe(200);
      const body = await page.locator("body").innerText();
      expect(body, `${path} shows a broken value`).not.toMatch(
        /NaN|Invalid Date|\[object Object\]/,
      );
    }
  });

  test("refuses an email that already has an account", async ({ page }) => {
    const email = unique();
    for (const attempt of [1, 2]) {
      await page.goto("/signup");
      await page.fill("#businessName", `Duplicate Test ${attempt}`);
      await page.fill("#name", "Jo Taylor");
      await page.fill("#email", email);
      await page.fill("#password", "a-long-enough-password");
      await page.click("button[type=submit]");
      if (attempt === 1) {
        await page.waitForURL(/\/dashboard/, { timeout: 40_000 });
        // Sign out so the second attempt is a genuine signup, not a signed-in one.
        await page.context().clearCookies();
      } else {
        await expect(page.locator("body")).toContainText(/already uses that email/i);
        expect(page.url(), "should stay on the form").toContain("/signup");
      }
    }
  });

  test("rejects a password that is too short, without creating anything", async ({ page }) => {
    await page.goto("/signup");
    await page.fill("#businessName", "Short Password Co");
    await page.fill("#name", "Pat Lee");
    await page.fill("#email", unique());
    // minLength on the input stops the browser submitting, so this asserts the
    // control is there — the server schema is covered by unit tests.
    await page.fill("#password", "short");
    await page.click("button[type=submit]");
    await page.waitForTimeout(800);
    expect(page.url(), "a short password must not create a business").toContain("/signup");
  });
});
