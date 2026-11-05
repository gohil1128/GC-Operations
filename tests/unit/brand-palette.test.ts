import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  The brand colour system: seven colours, each with its 500 shade as the anchor.
  These pin the anchors (the swatch on the brand sheet) to the CSS tokens.
*/
const css = readFileSync("src/app/globals.css", "utf8");
const root = css.slice(css.indexOf(":root {"), css.indexOf(".dark {"));

function hex(name: string) {
  const m = new RegExp(`--${name}-500:\\s*(\\d+) (\\d+)% (\\d+)%`).exec(root)!;
  const [h, s, l] = [Number(m[1]), Number(m[2]) / 100, Number(m[3]) / 100];
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return "#" + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}
const near = (a: string, b: string) =>
  [1, 3, 5].every((i) => Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)) <= 3);

describe("brand palette anchors", () => {
  const anchors: Record<string, string> = {
    marigold: "#F2A93C", coral: "#FF7A66", cocoa: "#2B1B12", cream: "#FDF5EE",
    ivory: "#FFFCF5", peach: "#FCE4CC", sun: "#F5BD1C",
  };
  for (const [n, h] of Object.entries(anchors)) {
    it(`${n} 500 is ${h}`, () => expect(near(hex(n), h), `${hex(n)} vs ${h}`).toBe(true));
  }
  it("defines every shade 100-900", () => {
    for (const n of Object.keys(anchors)) for (let k = 100; k <= 900; k += 100) expect(root).toContain(`--${n}-${k}:`);
  });
  it("uses marigold as the primary highlight", () => expect(root).toMatch(/--highlight:\s*36 88% 59%/));
});
