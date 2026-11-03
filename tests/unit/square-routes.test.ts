import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const syncAllSquare = vi.fn();
vi.mock("@/modules/square/service", () => ({ syncAllSquare: (...a: unknown[]) => syncAllSquare(...a) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { POST } from "@/app/api/cron/sync-square/route";
import * as route from "@/app/api/cron/sync-square/route";
import { MailConfigError } from "@/modules/mail/crypto";
import { SQUARE_SCOPES, squareAuthUrl, squareBase } from "@/modules/square/client";

/*
  The scheduler's door into the Square sync, and the permission the app asks
  Square for. The door must fail closed and answer with counts only; the
  permission must be read-only.
*/

const call = (auth?: string) =>
  new NextRequest("https://www.bolochai.com/api/cron/sync-square", { method: "POST", headers: auth ? { authorization: auth } : {} });

const result = { ran: true, ordersRead: 42, daysWritten: 3, manualDaysKept: ["2026-10-04"], foreignCurrency: 0, partial: false };

const saved: Record<string, string | undefined> = {};
const KEYS = ["CRON_SECRET", "SQUARE_APPLICATION_ID", "SQUARE_APPLICATION_SECRET", "SQUARE_REDIRECT_URI", "SQUARE_ENVIRONMENT"];
beforeEach(() => {
  for (const k of KEYS) saved[k] = process.env[k];
  process.env.CRON_SECRET = "s3cret-value";
  syncAllSquare.mockReset();
});
afterEach(() => {
  for (const k of KEYS) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
});

describe("the Square sync's scheduler door", () => {
  it("fails CLOSED with no secret configured, or an empty one", async () => {
    delete process.env.CRON_SECRET;
    expect((await POST(call("Bearer anything"))).status).toBe(503);
    process.env.CRON_SECRET = "";
    expect((await POST(call("Bearer "))).status).toBe(503);
    expect(syncAllSquare).not.toHaveBeenCalled();
  });

  it("rejects a missing, wrong, or differently-shaped credential", async () => {
    for (const a of [undefined, "", "Bearer wrong", "s3cret-value", "bearer s3cret-value", "Bearer s3cret-value-x"]) {
      expect((await POST(call(a))).status, String(a)).toBe(401);
    }
    expect(syncAllSquare).not.toHaveBeenCalled();
  });

  it("syncs for the right secret and returns counts only", async () => {
    syncAllSquare.mockResolvedValue([result]);
    const res = await POST(call("Bearer s3cret-value"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, synced: 1 });
    expect(body.results[0]).toMatchObject({ ordersRead: 42, daysWritten: 3, manualDaysKept: 1 });
    // The list of days is reduced to a count: nothing about the business's trading leaves.
    expect(JSON.stringify(body)).not.toContain("2026-10-04");
  });

  it("reports not-configured as 503, and hides the detail of a real failure", async () => {
    syncAllSquare.mockRejectedValueOnce(new MailConfigError("Square is not set up yet: SQUARE_APPLICATION_ID."));
    expect((await POST(call("Bearer s3cret-value"))).status).toBe(503);
    syncAllSquare.mockRejectedValueOnce(new Error("token=abc123 leaked"));
    const res = await POST(call("Bearer s3cret-value"));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("abc123");
  });

  it("offers no GET, so a link preview cannot set it off", () => {
    expect("GET" in route).toBe(false);
  });
});

describe("the permission asked of Square", () => {
  beforeEach(() => {
    process.env.SQUARE_APPLICATION_ID = "sq0idp-test";
    process.env.SQUARE_APPLICATION_SECRET = "sq0csp-test";
    process.env.SQUARE_REDIRECT_URI = "https://www.bolochai.com/api/square/callback";
  });

  it("is read-only, nothing else", () => {
    expect(SQUARE_SCOPES.length).toBeGreaterThan(0);
    for (const s of SQUARE_SCOPES) expect(s).toMatch(/_READ$/);
    const u = new URL(squareAuthUrl("st"));
    expect(u.searchParams.get("scope")!.split(" ").every((s) => s.endsWith("_READ"))).toBe(true);
  });

  it("carries the state and the registered redirect, and always shows Square's sign-in", () => {
    const u = new URL(squareAuthUrl("signed-state"));
    expect(u.origin).toBe("https://connect.squareup.com");
    expect(u.pathname).toBe("/oauth2/authorize");
    expect(u.searchParams.get("state")).toBe("signed-state");
    expect(u.searchParams.get("redirect_uri")).toBe("https://www.bolochai.com/api/square/callback");
    expect(u.searchParams.get("session")).toBe("false");
    // The secret never goes to the browser.
    expect(u.toString()).not.toContain("sq0csp");
  });

  it("uses Square's sandbox only when asked to", () => {
    expect(squareBase()).toBe("https://connect.squareup.com");
    process.env.SQUARE_ENVIRONMENT = "sandbox";
    expect(squareBase()).toBe("https://connect.squareupsandbox.com");
  });
});
