import { describe, expect, it } from "vitest";
import { FAN_RADIUS, FAN_SIZE, fanPositions } from "@/components/ui/photo-input";

/*
  The attach fan puts 2 or 3 tap targets on an arc around one button. If two of
  them overlap, a thumb aimed at "Upload PDF" lands on "Take photo" — and that
  looks fine in a screenshot, so it needs a test rather than an eyeball.
*/

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe("attach fan geometry", () => {
  for (const n of [1, 2, 3]) {
    it(`${n} choice${n > 1 ? "s" : ""}: every one sits on the arc`, () => {
      const spots = fanPositions(n);
      expect(spots).toHaveLength(n);
      for (const s of spots) expect(Math.hypot(s.x, s.y)).toBeCloseTo(FAN_RADIUS, -0.3); // within ~1px of rounding
    });
  }

  it("no two neighbouring circles overlap, and keep a gap a finger can land in", () => {
    for (const n of [2, 3]) {
      const spots = fanPositions(n);
      for (let i = 1; i < n; i++) {
        const gap = dist(spots[i], spots[i - 1]) - FAN_SIZE;
        expect(gap, `${n} choices, ${i - 1}→${i}`).toBeGreaterThanOrEqual(8);
      }
    }
  });

  it("no choice covers the trigger itself", () => {
    for (const n of [1, 2, 3]) {
      for (const s of fanPositions(n)) expect(Math.hypot(s.x, s.y)).toBeGreaterThanOrEqual(FAN_SIZE + 8);
    }
  });

  it("opens to the right, so it never runs off the left edge of a form", () => {
    for (const n of [1, 2, 3]) for (const s of fanPositions(n)) expect(s.x).toBeGreaterThan(0);
  });

  it("is symmetric about the trigger's row, so it never favours up or down", () => {
    for (const n of [2, 3]) {
      const ys = fanPositions(n).map((s) => s.y).sort((a, b) => a - b);
      expect(ys[0]).toBe(-ys[ys.length - 1]);
    }
  });

  it("gives nothing for a count it does not know, rather than throwing", () => {
    expect(fanPositions(0)).toEqual([]);
    expect(fanPositions(7)).toEqual([]);
  });
});
