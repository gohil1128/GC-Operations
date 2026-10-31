import { describe, it, expect } from "vitest";

/*
  Which day is "today"?

  /cash/new defaults its date to new Date().toISOString().slice(0, 10) — a
  server component, so this evaluates in the SERVER's timezone. The production
  server runs UTC; the business trades in Toronto. From 8pm EDT (7pm EST) the
  two disagree about the date, and every market that runs into the evening is
  exactly then.

  These tests use a fixed instant rather than the clock, so they assert the rule
  and not the hour they happen to run at.
*/

const isoDayUTC = (instant: string) => new Date(instant).toISOString().slice(0, 10);

const isoDayInToronto = (instant: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(instant));

describe("which day a close is filed under", () => {
  it("agrees with Toronto during trading hours", () => {
    // 2pm EDT, a Saturday market in full swing.
    const afternoon = "2026-09-13T18:00:00Z";
    expect(isoDayUTC(afternoon)).toBe("2026-09-13");
    expect(isoDayInToronto(afternoon)).toBe("2026-09-13");
  });

  /*
    THE BUG. 8:30pm on the 13th in Toronto is already the 14th in UTC, so the
    close defaults to TOMORROW. The operator counts the till at the end of a
    Saturday market and the entry is filed under Sunday — where it will not line
    up with that day's sales, and where the next day's real close will collide
    with it on the (locationId, businessDate) unique key.
  */
  it("files an evening close under TOMORROW", () => {
    const evening = "2026-09-14T00:30:00Z"; // 8:30pm EDT on the 13th
    expect(isoDayInToronto(evening)).toBe("2026-09-13");
    expect(isoDayUTC(evening)).toBe("2026-09-14"); // <-- what the app uses
    expect(isoDayUTC(evening)).not.toBe(isoDayInToronto(evening));
  });

  it("is wrong for every instant from 8pm EDT to midnight", () => {
    const eveningInstants = [
      "2026-09-14T00:00:00Z", // 8:00pm EDT
      "2026-09-14T01:00:00Z", // 9:00pm
      "2026-09-14T02:00:00Z", // 10:00pm
      "2026-09-14T03:59:00Z", // 11:59pm
    ];
    for (const i of eveningInstants) {
      expect(isoDayInToronto(i)).toBe("2026-09-13");
      expect(isoDayUTC(i)).toBe("2026-09-14");
    }
  });

  it("is wrong an hour earlier in winter, when the offset is UTC-5", () => {
    const winterEvening = "2026-01-11T00:30:00Z"; // 7:30pm EST on the 10th
    expect(isoDayInToronto(winterEvening)).toBe("2026-01-10");
    expect(isoDayUTC(winterEvening)).toBe("2026-01-11");
  });

  /*
    The same fault in the other direction, and the reason this cannot be fixed
    by simply subtracting hours: a business in Auckland is AHEAD of UTC, so its
    morning is still the previous UTC day. Any fix has to carry the tenant's
    timezone, which nothing in the schema does today — there is no timezone
    column on Business or Location.
  */
  it("would be wrong the opposite way for a tenant ahead of UTC", () => {
    const aucklandMorning = "2026-09-13T20:00:00Z"; // 8am on the 14th in Auckland
    const inAuckland = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Pacific/Auckland",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date(aucklandMorning));
    expect(inAuckland).toBe("2026-09-14");
    expect(isoDayUTC(aucklandMorning)).toBe("2026-09-13");
  });
});
