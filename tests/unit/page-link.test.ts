import { describe, expect, it } from "vitest";
import { pageNavigationTarget, type ClickFacts } from "@/lib/page-link";

const here = new URL("https://ops.example.com/dashboard?event=1");
const plain: ClickFacts = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
const a = (href: string, over: Partial<{ target: string; download: boolean }> = {}) => ({ href, target: "", download: false, ...over });

describe("which clicks open another screen", () => {
  it("returns the path and query being opened", () => {
    expect(pageNavigationTarget(a("https://ops.example.com/events"), plain, here)).toBe("/events");
    expect(pageNavigationTarget(a("https://ops.example.com/events?show=traded"), plain, here)).toBe("/events?show=traded");
    expect(pageNavigationTarget(a("/reports"), plain, here)).toBe("/reports");
  });

  it("ignores a link to where you already are, and a jump within the page", () => {
    expect(pageNavigationTarget(a("https://ops.example.com/dashboard?event=1"), plain, here)).toBeNull();
    expect(pageNavigationTarget(a("https://ops.example.com/dashboard?event=1#chart"), plain, here)).toBeNull();
    expect(pageNavigationTarget(a("#main"), plain, here)).toBeNull();
  });

  it("treats the same path with a different query as a new screen", () => {
    expect(pageNavigationTarget(a("https://ops.example.com/dashboard?event=2"), plain, here)).toBe("/dashboard?event=2");
  });

  it("ignores new tabs, downloads, other sites and the API (CSV exports, print)", () => {
    expect(pageNavigationTarget(a("/events", { target: "_blank" }), plain, here)).toBeNull();
    expect(pageNavigationTarget(a("/events", { download: true }), plain, here)).toBeNull();
    expect(pageNavigationTarget(a("https://elsewhere.example.com/events"), plain, here)).toBeNull();
    expect(pageNavigationTarget(a("/api/reports/export?kind=pnl"), plain, here)).toBeNull();
  });

  it("ignores modified and non-primary clicks, which open tabs or menus", () => {
    for (const mod of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }, { button: 2 }]) {
      expect(pageNavigationTarget(a("/events"), { ...plain, ...mod }, here)).toBeNull();
    }
  });

  it("copes with a href that is not a URL", () => {
    expect(pageNavigationTarget(a("http://"), plain, here)).toBeNull();
  });

  it("accepts target=_self", () => {
    expect(pageNavigationTarget(a("/events", { target: "_self" }), plain, here)).toBe("/events");
  });
});
