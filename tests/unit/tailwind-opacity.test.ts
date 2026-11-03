import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/*
  Tailwind's opacity scale steps in fives. A class like `bg-brand/12` is not an
  error and not a warning — it simply generates no CSS, and the element renders
  with no background at all.

  This has now bitten this repo twice. Once it made a masthead eyebrow dark ink
  on a dark photograph (invisible). Once it left the events board's loss tickets
  with no red tint and no working hover, which stood for days because the border
  beside it used an on-scale value and looked deliberate.

  Both were found by grepping, not by looking. So the grep lives here.
*/

/*
  A regex literal, not new RegExp with a template string. The first version of
  this built the pattern with `\\\\b`, which inside a template literal is a
  LITERAL backslash followed by b — not a word boundary — so it matched nothing
  and the test passed against a file that really did contain `/12`. Caught by
  deliberately reintroducing the bug and watching the test stay green.
*/
const MODIFIER =
  /\b(?:bg|text|border|from|to|via|ring|fill|stroke|shadow|outline|divide|placeholder|accent|caret|decoration)-[a-zA-Z0-9-]+\/(\d{1,3})\b/g;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, out);
    } else if (/\.(tsx?|css)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("Tailwind opacity modifiers", () => {
  it("are all multiples of five, or they generate no CSS", () => {
    const offenders: string[] = [];

    for (const file of sourceFiles("src")) {
      const text = readFileSync(file, "utf8");
      text.split("\n").forEach((line, i) => {
        for (const m of line.matchAll(MODIFIER)) {
          const value = Number(m[1]);
          // Arbitrary values in square brackets are exempt — `/[12%]` is real CSS.
          if (line.includes(`/[`)) continue;
          if (value > 100 || value % 5 !== 0) {
            offenders.push(`${file}:${i + 1}  ${m[0]}`);
          }
        }
      });
    }

    expect(
      offenders,
      `These generate NO CSS and silently fall back:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
