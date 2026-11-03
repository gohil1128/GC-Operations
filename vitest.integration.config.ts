import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

/*
  Tests that need a real Postgres.

  Kept apart from `pnpm test` on purpose: the deploy pipeline runs the unit
  tests with no database, and a suite that needs one would fail every deploy.
  Run these locally with DATABASE_URL pointing at a throwaway database whose
  name contains "test":

      pnpm run test:integration

  Each file refuses to run against any other database.
*/
process.env.TZ = "America/Toronto";

export default defineConfig({
  resolve: { alias: { "@": resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30_000,
    fileParallelism: false,
    reporters: ["default"],
  },
});
