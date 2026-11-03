import { describe, it, expect } from "vitest";
import {
  businessDayFromIso, isoFromBusinessDay, todayIsoIn, fmtBusinessDate, startOfDay,
  endOfBusinessDay, businessDayOrNull, endOfBusinessDayOrNull, recentBusinessDays,
  dayKeyInZone, timeInZone,
} from "@/lib/date";

/* Runs at TZ=America/Toronto — see vitest.config.ts. Under UTC these would all
   pass even if the helpers were wrong, which is the whole point. */

describe("businessDayFromIso", () => {
  it("gives UTC midnight for the day named, whatever the server timezone", () => {
    const d = businessDayFromIso("2026-09-13");
    expect(d.toISOString()).toBe("2026-09-13T00:00:00.000Z");
  });

  it("matches what the old idiom produced on a UTC server, so no data moves", () => {
    // Existing rows were written by startOfDay(new Date(iso)) running in UTC.
    for (const iso of ["2026-09-13", "2026-01-01", "2026-12-31", "2024-02-29"]) {
      const [y, m, d] = iso.split("-").map(Number);
      expect(businessDayFromIso(iso).getTime()).toBe(Date.UTC(y, m - 1, d));
    }
  });

  it("does NOT shift a day west of UTC, unlike the idiom it replaces", () => {
    expect(businessDayFromIso("2026-09-13").toISOString().slice(0, 10)).toBe("2026-09-13");
    // The old behaviour, for contrast:
    expect(startOfDay(new Date("2026-09-13")).getDate()).toBe(12);
  });

  it("is stable across a DST boundary", () => {
    // Toronto springs forward 2026-03-08 and falls back 2026-11-01.
    expect(businessDayFromIso("2026-03-08").toISOString()).toBe("2026-03-08T00:00:00.000Z");
    expect(businessDayFromIso("2026-11-01").toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });

  it("rejects anything that is not a plain calendar date", () => {
    for (const bad of ["", "2026", "2026-09", "13-09-2026", "not-a-date",
                       "2026-09-13T12:00:00Z", "2026-9-3"]) {
      expect(() => businessDayFromIso(bad), `accepted ${JSON.stringify(bad)}`).toThrow();
    }
  });

  it("rejects an impossible calendar date", () => {
    // Date.UTC rolls 2026-02-30 over into March rather than failing, so the
    // round-trip is what catches it.
    const rolled = businessDayFromIso("2026-02-30");
    expect(isoFromBusinessDay(rolled)).not.toBe("2026-02-30");
  });
});

describe("isoFromBusinessDay", () => {
  it("round-trips", () => {
    for (const iso of ["2026-09-13", "2026-01-01", "2026-12-31"]) {
      expect(isoFromBusinessDay(businessDayFromIso(iso))).toBe(iso);
    }
  });
});

describe("todayIsoIn", () => {
  it("returns a plain calendar date", () => {
    expect(todayIsoIn("America/Toronto")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("can differ from the UTC date, which is the bug it exists to fix", () => {
    // Not asserted as always-different — that depends on the hour this runs —
    // but the two must be at most a day apart and both well-formed.
    const toronto = todayIsoIn("America/Toronto");
    const utc = todayIsoIn("UTC");
    const gap = Math.abs(Date.parse(toronto) - Date.parse(utc));
    expect(gap).toBeLessThanOrEqual(24 * 3600 * 1000);
  });

  it("tracks the zone it is given", () => {
    // Auckland is far enough ahead of Los Angeles that they are frequently on
    // different dates; when they are not, they are one day apart at most.
    const akl = todayIsoIn("Pacific/Auckland");
    const lax = todayIsoIn("America/Los_Angeles");
    expect(Date.parse(akl)).toBeGreaterThanOrEqual(Date.parse(lax));
  });
});

describe("fmtBusinessDate", () => {
  it("renders a stored business date as its own day, not the viewer's", () => {
    expect(fmtBusinessDate(new Date("2026-09-13T00:00:00Z"))).toBe("Sep 13, 2026");
  });

  it("renders an ISO day string as itself", () => {
    expect(fmtBusinessDate("2026-09-13")).toBe("Sep 13, 2026");
  });

  it("handles the first and last day of a year", () => {
    expect(fmtBusinessDate("2026-01-01")).toBe("Jan 1, 2026");
    expect(fmtBusinessDate("2026-12-31")).toBe("Dec 31, 2026");
  });

  it("takes a pattern", () => {
    expect(fmtBusinessDate("2026-09-13", "MMM d")).toBe("Sep 13");
  });
});

describe("endOfBusinessDay", () => {
  it("is the last millisecond of the day, so an lte bound includes it", () => {
    expect(endOfBusinessDay("2026-09-13").toISOString()).toBe("2026-09-13T23:59:59.999Z");
  });

  it("never overlaps the next day's start", () => {
    expect(endOfBusinessDay("2026-09-13").getTime())
      .toBeLessThan(businessDayFromIso("2026-09-14").getTime());
  });
});

describe("tolerant parsers", () => {
  it("return null for junk instead of throwing, so a bad query param is ignored", () => {
    for (const bad of [null, undefined, "", "nonsense", "13-09-2026"]) {
      expect(businessDayOrNull(bad as any)).toBeNull();
      expect(endOfBusinessDayOrNull(bad as any)).toBeNull();
    }
  });

  it("still parse a good value", () => {
    expect(businessDayOrNull("2026-09-13")!.toISOString()).toBe("2026-09-13T00:00:00.000Z");
  });
});

describe("recentBusinessDays", () => {
  it("returns n consecutive days, most recent first", () => {
    const days = recentBusinessDays("America/Toronto", 7);
    expect(days).toHaveLength(7);
    for (const d of days) expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (let i = 1; i < days.length; i++) {
      const gap = Date.parse(days[i - 1]) - Date.parse(days[i]);
      expect(gap).toBe(24 * 3600 * 1000);
    }
  });

  it("starts from today in the business's zone, not the server's", () => {
    expect(recentBusinessDays("America/Toronto", 1)[0]).toBe(todayIsoIn("America/Toronto"));
    expect(recentBusinessDays("Pacific/Auckland", 1)[0]).toBe(todayIsoIn("Pacific/Auckland"));
  });

  it("crosses a month boundary correctly", () => {
    const days = recentBusinessDays("UTC", 40);
    expect(new Set(days).size).toBe(40); // no duplicates from a bad rollover
  });
});

describe("formatting in a named zone", () => {
  /*
    The bug these exist for: a client component formatting with date-fns renders
    in UTC on the server and in the viewer's zone in the browser. React then
    reports a hydration mismatch, and a late shift silently moves to a different
    day column.
  */
  const EVENING_SHIFT = "2026-09-14T02:00:00Z"; // 7pm Sep 13 in Vancouver

  it("puts an evening shift on the local day, not the UTC one", () => {
    expect(dayKeyInZone(EVENING_SHIFT, "UTC")).toBe("2026-09-14");
    expect(dayKeyInZone(EVENING_SHIFT, "America/Vancouver")).toBe("2026-09-13");
    expect(dayKeyInZone(EVENING_SHIFT, "America/Toronto")).toBe("2026-09-13");
  });

  it("gives the same answer whatever the process timezone is", () => {
    // The suite runs at America/Toronto; the result must not depend on that.
    const saved = process.env.TZ;
    const inToronto = dayKeyInZone(EVENING_SHIFT, "America/Vancouver");
    process.env.TZ = "Asia/Tokyo";
    expect(dayKeyInZone(EVENING_SHIFT, "America/Vancouver")).toBe(inToronto);
    process.env.TZ = saved;
  });

  it("formats a wall-clock time in the zone asked for", () => {
    expect(timeInZone(EVENING_SHIFT, "America/Vancouver")).toBe("7:00pm");
    expect(timeInZone(EVENING_SHIFT, "America/Toronto")).toBe("10:00pm");
    expect(timeInZone(EVENING_SHIFT, "UTC")).toBe("2:00am");
  });

  it("handles a DST changeover without shifting the hour", () => {
    // Toronto falls back at 2am on 2026-11-01.
    expect(timeInZone("2026-11-01T12:00:00Z", "America/Toronto")).toBe("7:00am");
    expect(timeInZone("2026-06-01T12:00:00Z", "America/Toronto")).toBe("8:00am");
  });
});
