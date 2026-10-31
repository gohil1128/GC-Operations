import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

/*
  Unit tests for the pure logic — money, dates, permissions, reconciliation,
  costing. No database and no React: these are the functions that decide what a
  business is told about its own cash, and they are worth pinning exactly.

  TZ is forced to America/Toronto rather than left to the machine. The business
  is in Ontario, the production server runs in UTC, and several of these
  functions build a Date from a YYYY-MM-DD string — which parses as UTC
  midnight and then gets read back in local time. A suite that runs in UTC
  cannot see that class of bug at all, which is exactly how it survived.
*/
process.env.TZ = "America/Toronto";

export default defineConfig({
  resolve: { alias: { "@": resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"],
    reporters: ["default"],
  },
});
