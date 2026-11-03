import { type Page, type APIRequestContext, expect } from "@playwright/test";

/*
  Accounts come from the environment so the suite carries no credentials.
  Set these to seeded users before running; the E2E job in CI seeds them.
*/
export const ACCOUNTS = {
  owner: {
    email: process.env.E2E_OWNER_EMAIL ?? "e2e-owner@example.test",
    password: process.env.E2E_OWNER_PASSWORD ?? process.env.E2E_PASSWORD ?? "",
  },
  staff: {
    email: process.env.E2E_STAFF_EMAIL ?? "e2e-staff@example.test",
    password: process.env.E2E_STAFF_PASSWORD ?? process.env.E2E_PASSWORD ?? "",
  },
};

/** Where each role's signed-in session is cached by auth.setup.ts. */
export const STATE_FILES = {
  owner: "tests/e2e/.auth/owner.json",
  staff: "tests/e2e/.auth/staff.json",
} as const;

/*
  Kept for the rare test that genuinely needs a fresh sign-in. Ordinary tests
  should use the storageState projects instead — see auth.setup.ts for why
  signing in per test is both slow and self-defeating against the rate limiter.
*/
export async function signIn(page: Page, who: keyof typeof ACCOUNTS) {
  const { email, password } = ACCOUNTS[who];
  await page.goto("/login");
  await page.fill("input[type=email]", email);
  await page.fill("input[type=password]", password);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/(dashboard|cash)/, { timeout: 30_000 });
}

/** The visible text of the whole page, including portalled toasts. */
export async function bodyText(page: Page): Promise<string> {
  return page.locator("body").innerText();
}

/**
 * Assert a page is NOT reachable by this role. The app redirects rather than
 * 404ing, so the check is on where you land, not on a status code.
 */
export async function expectRedirectedAwayFrom(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  expect(page.url(), `${path} should not be reachable`).not.toContain(path);
}

export async function statusOf(request: APIRequestContext, path: string): Promise<number> {
  const r = await request.get(path);
  return r.status();
}
