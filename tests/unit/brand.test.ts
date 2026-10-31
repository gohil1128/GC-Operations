import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/*
  No customer's name may be written into the product.

  "God's Chai" was in nine files — the PWA manifest, the document title, the iOS
  web-clip title, the sidebar's accessible label, the alt text on every logo and
  the password-reset subject line. A second customer installed an app named
  after the first one.

  The name is a variable now. This fails the build if it goes back to being a
  literal, which is the only way a change like that gets noticed: every one of
  those nine sites renders fine and simply says the wrong thing.
*/

const ALLOWED = new Set([
  // Where the default legitimately lives.
  "src/lib/brand.ts",
]);

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(tsx?|json)$/.test(entry)) out.push(full);
  }
  return out;
}

/** Strip // line comments and block comments so prose about the bug is exempt. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("the customer's name is not baked into the product", () => {
  it("appears in no source file but the brand defaults", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles("src")) {
      if (ALLOWED.has(file)) continue;
      const text = code(readFileSync(file, "utf8"));
      // Both the plain apostrophe and the JSX-escaped form.
      if (/god.{0,6}s\s+chai/i.test(text) || /bolochai/i.test(text)) {
        offenders.push(file);
      }
    }
    expect(
      offenders,
      `A customer name is hardcoded here. Use APP_NAME from @/lib/brand:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("exposes a name, a short name and a description", async () => {
    const brand = await import("@/lib/brand");
    for (const key of ["APP_NAME", "APP_SHORT_NAME", "APP_DESCRIPTION"] as const) {
      expect(typeof brand[key], key).toBe("string");
      expect(brand[key].length, key).toBeGreaterThan(0);
    }
  });

  it("takes its values from the environment, so white-labelling needs no code change", () => {
    const src = readFileSync("src/lib/brand.ts", "utf8");
    for (const v of [
      "NEXT_PUBLIC_APP_NAME",
      "NEXT_PUBLIC_APP_SHORT_NAME",
      "NEXT_PUBLIC_APP_DESCRIPTION",
    ]) {
      expect(src, `${v} should be readable from the environment`).toContain(`process.env.${v}`);
    }
  });
});
