import { beforeEach, describe, expect, it } from "vitest";
import { markNavigation, takeNavigationKind } from "@/lib/nav-kind";

describe("how a navigation started", () => {
  beforeEach(() => {
    takeNavigationKind(); // clear anything left by another test
  });

  it("is an ordinary tap unless something marked it", () => {
    expect(takeNavigationKind()).toBeNull();
  });

  it("reports a mark once: reading it clears it", () => {
    markNavigation("swipe", 1000);
    expect(takeNavigationKind(1100)).toBe("swipe");
    expect(takeNavigationKind(1100)).toBeNull();
  });

  it("lets a back gesture that landed on the same path lapse, so the next tap still gets its entrance", () => {
    markNavigation("history", 1000);
    expect(takeNavigationKind(1000 + 1501)).toBeNull();
    // ...and a stale mark is cleared by being read, not carried to the next tap.
    expect(takeNavigationKind(1000 + 1502)).toBeNull();
  });

  it("holds a swipe's mark long enough for a slow page to arrive", () => {
    markNavigation("swipe", 1000);
    expect(takeNavigationKind(1000 + 6500)).toBe("swipe");
    markNavigation("swipe", 1000);
    expect(takeNavigationKind(1000 + 8001)).toBeNull();
  });

  it("keeps the latest mark when two are made before a read", () => {
    markNavigation("history", 1000);
    markNavigation("swipe", 1010);
    expect(takeNavigationKind(1020)).toBe("swipe");
  });
});
