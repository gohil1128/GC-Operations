import { defineConfig, devices } from "@playwright/test";
import { STATE_FILES as STATE } from "./tests/e2e/helpers";

// Pre-installed in this environment; PLAYWRIGHT_BROWSERS_PATH points at it.
const chromium = {
  ...devices["Desktop Chrome"],
  launchOptions: process.env.PW_CHROMIUM_PATH
    ? { executablePath: process.env.PW_CHROMIUM_PATH }
    : {},
};

/*
  End-to-end tests for the things that are expensive to get wrong: who can see
  what, whether a locked section stays locked, and whether the cash arithmetic
  moves by the amount it should.

  These were all verified by hand while the bugs were being fixed. Committing
  them is what stops the same bugs coming back — every one of the section-lock
  failures they cover shipped to production and sat there unnoticed.

  Expects a built app already running at BASE_URL against a seeded database.
  Locally:  pnpm build && pnpm start -p 3111  then  pnpm test:e2e
*/
export default defineConfig({
  testDir: "./tests/e2e",
  // Serial. The suite mutates shared state — locking sections, tripping the PIN
  // rate limiter — and parallel workers would race each other through it.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3111",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    // Signs in once per role and caches the session. Everything else reuses it:
    // signing in per test is slow, and a burst of sign-ins looks exactly like a
    // password-guessing run to the app's own login limiter.
    { name: "setup", testMatch: /auth\.setup\.ts/, use: chromium },

    {
      name: "owner",
      use: { ...chromium, storageState: STATE.owner },
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
      // The staff-only cases sign themselves in; everything else runs as owner.
      testMatch: /(section-lock|cash-arithmetic)\.spec\.ts/,
    },
    {
      // Signup runs signed OUT, so it takes no stored session.
      name: "signup",
      use: chromium,
      testMatch: /signup\.spec\.ts/,
    },
    {
      name: "access-control",
      // Signs in explicitly per role, because that is the thing under test.
      use: chromium,
      dependencies: ["setup"],
      testMatch: /access-control\.spec\.ts/,
    },
  ],
});
