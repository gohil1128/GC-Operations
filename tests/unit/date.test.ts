import { describe, it, expect } from "vitest";
import { businessDay, fmtDate, safeDateParam, startOfDay } from "@/lib/date";

/*
  The business day is the join key for everything financial: a cash close, its
  deposits and its payouts are matched on (locationId, businessDate). If a
  YYYY-MM-DD string and a Date disagree about which day they mean, money lands
  on the wrong day — or on no day, and the close silently never finds its
  payouts.

  This file runs at TZ=America/Toronto (set in vitest.config.ts), which is where
  the business actually is. Under TZ=UTC every one of these passes trivially,
  which is why running the suite in UTC would prove nothing.
*/

const TZ_OFFSET_IS_BEHIND_UTC = new Date("2026-09-13T00:00:00Z").getDate() === 12;

describe("timezone assumption", () => {
  it("runs in a timezone behind UTC, where the bug is visible", () => {
    expect(process.env.TZ).toBe("America/Toronto");
    expect(TZ_OFFSET_IS_BEHIND_UTC).toBe(true);
  });
});

describe("businessDay", () => {
  /*
    THE BUG. new Date("2026-09-13") is parsed by spec as UTC midnight. In any
    timezone behind UTC that instant is the PREVIOUS calendar day locally, and
    startOfDay then snaps it to that previous day. So the string "2026-09-13"
    becomes September 12th.

    Reached from: saveCashCloseAction, addPayoutAction, addDepositAction and
    every cash query, all of which call startOfDay(new Date(parsed.businessDate))
    on a YYYY-MM-DD string straight from the URL or form.
  */
  it("shifts a bare YYYY-MM-DD string to the previous day west of UTC", () => {
    const d = businessDay("2026-09-13");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8); // September
    expect(d.getDate()).toBe(12); // <-- should be 13
  });

  it("is correct when given a Date built in local time", () => {
    const local = new Date(2026, 8, 13, 14, 30);
    const d = businessDay(local);
    expect(d.getDate()).toBe(13);
  });

  it("disagrees with itself depending on how the same day is expressed", () => {
    // The same calendar day, two ways in, two different stored days. This is
    // what lets a payout miss the close it belongs to.
    const fromString = businessDay("2026-09-13");
    const fromLocalDate = businessDay(new Date(2026, 8, 13));
    expect(fromString.getTime()).not.toBe(fromLocalDate.getTime());
  });
});

describe("fmtDate", () => {
  /*
    The display half of the same fault. A businessDate stored as UTC midnight
    formats in the viewer's local timezone, so a Toronto user reads every date
    in the app one day earlier than it is stored.
  */
  it("renders a UTC-midnight timestamp as the previous day", () => {
    expect(fmtDate(new Date("2026-09-13T00:00:00Z"))).toBe("Sep 12, 2026");
  });

  it("renders a locally-built date correctly", () => {
    expect(fmtDate(new Date(2026, 8, 13))).toBe("Sep 13, 2026");
  });

  it("formats a bare date string one day early", () => {
    expect(fmtDate("2026-09-13")).toBe("Sep 12, 2026");
  });
});

describe("safeDateParam", () => {
  it("passes through a valid date string", () => {
    expect(safeDateParam("2026-09-13")).toBe("2026-09-13");
  });

  it("rejects junk rather than letting it reach Prisma", () => {
    expect(safeDateParam("not-a-date")).toBeUndefined();
    expect(safeDateParam("")).toBeUndefined();
    expect(safeDateParam(null)).toBeUndefined();
    expect(safeDateParam(undefined)).toBeUndefined();
  });

  /*
    Validates parseability only, not shape or range. "2026-13-45" is rejected by
    Date, but a far-future or far-past year sails through and becomes a real
    query — and a string like "2026" parses fine and means January 1st.
  */
  it("accepts a bare year, which silently means January 1st", () => {
    expect(safeDateParam("2026")).toBe("2026");
    expect(startOfDay(new Date("2026")).getFullYear()).toBe(2025); // UTC shift again
  });

  it("accepts absurd but parseable years", () => {
    expect(safeDateParam("1000-01-01")).toBe("1000-01-01");
    expect(safeDateParam("9999-12-31")).toBe("9999-12-31");
  });
});
