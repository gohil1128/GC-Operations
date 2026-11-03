import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const scanAll = vi.fn();
vi.mock("@/modules/mail/service", () => ({ scanAll: (...a: unknown[]) => scanAll(...a) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { POST } from "@/app/api/cron/scan-invoices/route";
import * as route from "@/app/api/cron/scan-invoices/route";
import { MailConfigError } from "@/modules/mail/crypto";

const call = (auth?: string, method = "POST") =>
  new NextRequest("https://www.bolochai.com/api/cron/scan-invoices", { method, headers: auth ? { authorization: auth } : {} });

const result = { connectionId: "c", ran: true, listed: 3, triaged: 3, logged: 1, queued: 1, skipped: 1, failed: 0, partial: false };

let saved: string | undefined;
beforeEach(() => { saved = process.env.CRON_SECRET; process.env.CRON_SECRET = "s3cret-value"; scanAll.mockReset(); });
afterEach(() => { if (saved === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = saved; });

describe("the scheduler's door", () => {
  it("fails CLOSED when no secret is configured — never 'open'", async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(call("Bearer anything"));
    expect(res.status).toBe(503);
    expect(scanAll).not.toHaveBeenCalled();
  });

  it("also fails closed for an EMPTY secret", async () => {
    process.env.CRON_SECRET = "";
    expect((await POST(call("Bearer "))).status).toBe(503);
    expect(scanAll).not.toHaveBeenCalled();
  });

  it("rejects a missing, wrong, or differently-shaped credential", async () => {
    for (const a of [undefined, "", "Bearer wrong", "s3cret-value", "bearer s3cret-value", "Basic s3cret-value", "Bearer s3cret-value-and-more", "Bearer s3cret"]) {
      expect((await POST(call(a))).status, String(a)).toBe(401);
    }
    expect(scanAll).not.toHaveBeenCalled();
  });

  it("runs the scan for the right secret and returns counts only", async () => {
    scanAll.mockResolvedValue([result]);
    const res = await POST(call("Bearer s3cret-value"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, scanned: 1 });
    expect(body.results[0]).toMatchObject({ logged: 1, queued: 1, skipped: 1 });
    // Nothing identifying: no ids, no senders, no subjects.
    expect(JSON.stringify(body)).not.toMatch(/connectionId|from|subject|@/i);
    expect(scanAll).toHaveBeenCalledWith("cron");
  });

  it("answers 503, not 500, while the feature is simply not configured yet", async () => {
    scanAll.mockRejectedValue(new MailConfigError("Not set up yet: ANTHROPIC_API_KEY."));
    const res = await POST(call("Bearer s3cret-value"));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/ANTHROPIC_API_KEY/);
  });

  it("does not leak an internal error message on a real failure", async () => {
    scanAll.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5:5432 password=hunter2"));
    const res = await POST(call("Bearer s3cret-value"));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/hunter2|10\.0\.0\.5/);
  });

  it("is POST only — a crawler or link preview cannot start a scan", () => {
    expect((route as Record<string, unknown>).GET).toBeUndefined();
  });
});
