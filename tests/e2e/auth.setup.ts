import { test as setup, expect } from "@playwright/test";
import { ACCOUNTS, STATE_FILES } from "./helpers";

/*
  Sign in once per role and save the session, instead of signing in inside every
  test's beforeEach.

  Not just for speed, though it is most of the 21 minutes the first CI run took.
  Forty-odd sign-ins in a burst is indistinguishable from a password-guessing
  run, and the app's own login limiter treats it as one: five failures against
  an address locks it for fifteen minutes, so one bad credential turned into a
  whole suite of timeouts. Signing in twice cannot trip it.
*/

for (const role of ["owner", "staff"] as const) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    const { email, password } = ACCOUNTS[role];
    await page.goto("/login");
    await page.fill("input[type=email]", email);
    await page.fill("input[type=password]", password);
    await page.click("button[type=submit]");

    // Fail loudly and immediately on bad credentials rather than waiting out a
    // navigation timeout — the previous run's real problem was an account that
    // did not exist, reported as thirty seconds of silence.
    const landed = page
      .waitForURL(/\/(dashboard|cash)/, { timeout: 20_000 })
      .then(() => "ok" as const)
      .catch(() => "timeout" as const);
    const rejected = page
      .getByText(/incorrect|invalid|too many|locked/i)
      .first()
      .waitFor({ timeout: 20_000 })
      .then(() => "rejected" as const)
      .catch(() => "none" as const);

    const outcome = await Promise.race([landed, rejected]);
    if (outcome !== "ok") {
      throw new Error(
        `Could not sign in as ${role} (${email}). ` +
          `Run "pnpm db:seed && E2E_PASSWORD=... pnpm db:seed:e2e", and set ` +
          `E2E_${role.toUpperCase()}_EMAIL / E2E_${role.toUpperCase()}_PASSWORD if you use other accounts.`,
      );
    }

    await expect(page).toHaveURL(/\/(dashboard|cash)/);
    await page.context().storageState({ path: STATE_FILES[role] });
  });
}
