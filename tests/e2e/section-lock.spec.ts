import { test, expect } from "@playwright/test";
import { bodyText, statusOf } from "./helpers";

/*
  The section PIN, which is the only confidentiality boundary an owner controls
  INSIDE their own business. Three separate bypasses shipped to production and
  went unnoticed; each assertion below corresponds to one of them.

  Requires the business to have a PIN set and REPORTS, EVENTS and RECIPES
  locked. The suite sets that up through the UI so it does not need database
  access, and puts it back afterwards.
*/

const PIN = process.env.E2E_SECTION_PIN ?? "4321";

/*
  Each checkbox saves on change and sends the WHOLE list, so they are toggled
  one at a time with a wait between. Clicking them in a burst loses updates:
  the component re-seeds its state from the server after each refresh.
*/
async function setLock(page: import("@playwright/test").Page, locked: boolean) {
  await page.goto("/settings");
  await page.waitForLoadState("networkidle");

  const group = page.getByRole("group", { name: "Sections to lock" });
  await expect(group, "the section-lock card should be on the settings page").toBeVisible();

  for (const label of ["Profit & loss", "Events", "Recipes"]) {
    const box = group.getByRole("checkbox", { name: label });
    await expect(box, `no checkbox for ${label}`).toBeVisible();
    if (await box.isDisabled()) {
      throw new Error("Section locking is disabled — the business needs a PIN set first.");
    }
    if ((await box.isChecked()) !== locked) {
      await box.click();
      await page.waitForTimeout(900); // the action round-trip and router.refresh()
    }
  }

  // Confirm it actually took, rather than trusting the clicks. The first run of
  // this suite passed a "locked" assertion against a business that was not
  // locked at all, because the toggles silently missed.
  for (const label of ["Profit & loss", "Events", "Recipes"]) {
    await expect(
      group.getByRole("checkbox", { name: label }),
      `${label} did not end up ${locked ? "locked" : "unlocked"}`,
    ).toBeChecked({ checked: locked });
  }
}

test.describe("a locked section stays locked", () => {
  test("the overview chart does not print profit or margin while P&L is locked", async ({ page }) => {
    await setLock(page, true);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const card = page.locator(".bento", { hasText: "Revenue · by event" }).first();
    if ((await card.count()) === 0) test.skip(true, "no revenue chart rendered for this data");

    const text = await card.innerText();
    // The bug: exact per-event profit and margin printed directly under a
    // padlocked statement and a masked Profit tile.
    expect(text, "a margin percentage is visible under the lock").not.toMatch(/\d+\.\d%/);
    expect(text, "a signed profit figure is visible under the lock").not.toMatch(/[+−]\$/);

    // Withheld server-side, not hidden with CSS: the numbers must not be in the
    // markup at all, or they are one View Source away.
    const html = await page.content();
    expect(html).not.toContain("marginPct");
    expect(html).not.toContain("profitCents");

    await setLock(page, false);
  });

  test("downloads behind a locked section are refused", async ({ page }) => {
    await setLock(page, true);
    for (const key of ["pnl", "event-summary", "recipes", "events"]) {
      const status = await statusOf(page.request, `/api/exports/${key}`);
      expect(status, `/api/exports/${key} leaked past the lock`).toBe(403);
    }
    // A download that belongs to no locked section is unaffected.
    expect(await statusOf(page.request, "/api/exports/cash")).toBe(200);
    await setLock(page, false);
  });

  test("unlocked, the same downloads work", async ({ page }) => {
    await setLock(page, false);
    for (const key of ["pnl", "recipes", "events"]) {
      expect(await statusOf(page.request, `/api/exports/${key}`)).toBe(200);
    }
  });
});

test.describe("the PIN cannot be brute forced", () => {
  test("locks out after five wrong attempts", async ({ page }) => {
    test.skip(!process.env.E2E_SECTION_PIN, "needs a known PIN and a clean rate-limit table");
    await setLock(page, true);
    /*
      try/finally, not a trailing call. This test locks sections before it can
      probe anything, and it can end early in two ways — the skip below, and any
      failed expectation — both of which used to leave every section locked for
      whoever opened the app next, with the limiter still counting down.
    */
    try {
      await page.goto("/reports");
      await page.waitForLoadState("networkidle");

      const input = page.locator("#section-pin");

      /*
        The limiter is shared, durable state: a lockout from an earlier run (or
        from someone using the app) is still in force here. Skip rather than fail
        on it — a red test that only means "the feature already worked five
        minutes ago" trains people to ignore the suite.
      */
      await input.fill("0000");
      await page.waitForTimeout(1200);
      if (/Too many incorrect PINs/.test(await bodyText(page))) {
        test.skip(true, "already rate-limited from an earlier run; wait out the window");
      }

      let lockedOut = false;
      for (let i = 1; i <= 6; i++) {
        await input.fill(String(1000 + i));
        await page.waitForTimeout(1200);
        if (/Too many incorrect PINs/.test(await bodyText(page))) {
          lockedOut = true;
          expect(i, "should survive at least a few honest mistypes").toBeGreaterThan(2);
          break;
        }
      }
      expect(lockedOut, "six wrong PINs did not trip the limiter").toBe(true);
    } finally {
      await setLock(page, false);
    }
  });
});
