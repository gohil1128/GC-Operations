import { describe, expect, it } from "vitest";
import { paneAfterSwipe, rubberBand, settleMs } from "@/components/swipe-pager";

/*
  The decisions behind the swipe, ported from the gc-tasks board's carousel:
  whether a finished swipe changes pane, how long the settle takes, and how
  far the track gives past the ends.
*/
describe("paneAfterSwipe", () => {
  it("moves on a long drag, either way, and stays on a short slow one", () => {
    expect(paneAfterSwipe(1, 2, -80, 0)).toBe(2);
    expect(paneAfterSwipe(1, 2, 80, 0)).toBe(0);
    expect(paneAfterSwipe(1, 2, -30, 0.1)).toBeNull();
  });
  it("moves on a short fast flick", () => {
    expect(paneAfterSwipe(0, 2, -30, -0.6)).toBe(1);
  });
  it("a flick back the other way at the end cancels a long drag", () => {
    expect(paneAfterSwipe(0, 2, -90, 0.6)).toBeNull();
  });
  it("never goes past the first or last pane", () => {
    expect(paneAfterSwipe(2, 2, -120, -1)).toBeNull();
    expect(paneAfterSwipe(0, 2, 120, 1)).toBeNull();
  });
});

describe("settleMs", () => {
  it("is quicker for a faster flick, and always between 140 and 360ms", () => {
    expect(settleMs(300, 2)).toBeLessThan(settleMs(300, 0.9));
    expect(settleMs(1, 5)).toBe(140);
    expect(settleMs(5000, 0)).toBe(360);
  });
  it("still arrives when released dead slow", () => {
    expect(settleMs(300, 0)).toBe(settleMs(300, 0.8));
  });
});

describe("rubberBand", () => {
  it("is the identity inside the panes and a quarter as far past either end", () => {
    expect(rubberBand(1.3, 2)).toBe(1.3);
    expect(rubberBand(-1, 2)).toBeCloseTo(-0.25);
    expect(rubberBand(3, 2)).toBeCloseTo(2.25);
  });
});
