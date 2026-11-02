import { MailConfigError } from "@/modules/mail/crypto";

/*
  Square, read-only.

  The scopes asked for are all *_READ. The app reads orders (what was sold),
  payments (how it was paid), the item catalog (to name categories) and the
  merchant profile (the account's name and locations). It cannot take a
  payment, refund one, change a price or touch the catalog — Square rejects
  it, whatever a bug here tried to do.

  Plain fetch against Square's REST API rather than the Square SDK, which is a
  large dependency for six endpoints, and it keeps the request shape visible
  in one file.

  The sync never touches this directly: it takes a SquareClient, so tests hand
  it a fake account and nothing here needs a network to be exercised.
*/

export const SQUARE_SCOPES = ["MERCHANT_PROFILE_READ", "ORDERS_READ", "PAYMENTS_READ", "ITEMS_READ"];
/*
  Square pins behaviour to a dated API version sent on every request, and keeps
  old versions working for years. Pinning means an upgrade on Square's side
  can never change what these responses look like under us.
*/
export const SQUARE_VERSION = "2025-01-23";

/** Raised when Square no longer honours the grant: revoked, expired, or removed. */
export class SquareAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SquareAuthError";
  }
}

/* ── the subset of Square's Order object this app reads ── */

export type Money = { amount?: number | string | null; currency?: string | null } | null | undefined;

export type SquareLineItem = {
  name?: string | null;
  quantity?: string | null;
  catalog_object_id?: string | null;
  item_type?: string | null;
  total_money?: Money;
  total_tax_money?: Money;
};

export type SquareReturnLineItem = SquareLineItem;

export type SquareOrder = {
  id: string;
  location_id?: string;
  state?: string;
  closed_at?: string | null;
  line_items?: SquareLineItem[] | null;
  returns?: { return_line_items?: SquareReturnLineItem[] | null }[] | null;
  tenders?: { type?: string | null; amount_money?: Money; tip_money?: Money }[] | null;
  total_tip_money?: Money;
  return_amounts?: { tip_money?: Money } | null;
};

export type SquareLocation = { id: string; name: string; status: string; timezone: string | null; currency: string | null };

export interface SquareClient {
  merchant(): Promise<{ id: string; name: string }>;
  locations(): Promise<SquareLocation[]>;
  /** One page of COMPLETED orders closed in [startAt, endAt), oldest first. */
  searchOrders(opts: { locationIds: string[]; startAt: Date; endAt: Date; cursor?: string }): Promise<{ orders: SquareOrder[]; cursor?: string }>;
  /** Category name for each catalog item variation id it can resolve. */
  categoriesFor(variationIds: string[]): Promise<Map<string, string>>;
}

/* ── configuration ── */

const sandbox = () => (process.env.SQUARE_ENVIRONMENT ?? "").toLowerCase() === "sandbox";
export const squareBase = () => (sandbox() ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com");

function oauthEnv() {
  const id = process.env.SQUARE_APPLICATION_ID;
  const secret = process.env.SQUARE_APPLICATION_SECRET;
  const redirect = process.env.SQUARE_REDIRECT_URI;
  if (!id || !secret || !redirect) {
    throw new MailConfigError("SQUARE_APPLICATION_ID, SQUARE_APPLICATION_SECRET and SQUARE_REDIRECT_URI must be set.");
  }
  return { id, secret, redirect };
}

export const squareConfigured = () =>
  Boolean(process.env.SQUARE_APPLICATION_ID && process.env.SQUARE_APPLICATION_SECRET && process.env.SQUARE_REDIRECT_URI);

export function squareAuthUrl(state: string): string {
  const { id, redirect } = oauthEnv();
  const u = new URL("/oauth2/authorize", squareBase());
  u.searchParams.set("client_id", id);
  u.searchParams.set("scope", SQUARE_SCOPES.join(" "));
  // false = always show the sign-in screen, so it is clear which Square
  // account is being connected rather than silently reusing a browser session.
  u.searchParams.set("session", "false");
  u.searchParams.set("state", state);
  u.searchParams.set("redirect_uri", redirect);
  return u.toString();
}

/* ── OAuth ── */

async function tokenCall(body: Record<string, string>) {
  const { id, secret } = oauthEnv();
  const res = await fetch(new URL("/oauth2/token", squareBase()), {
    method: "POST",
    headers: { "Content-Type": "application/json", "Square-Version": SQUARE_VERSION },
    body: JSON.stringify({ client_id: id, client_secret: secret, ...body }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string; refresh_token?: string; merchant_id?: string; expires_at?: string;
    errors?: { code?: string; detail?: string }[];
  };
  if (!res.ok || !json.access_token) {
    const detail = json.errors?.map((e) => e.code ?? e.detail).join(", ") || `HTTP ${res.status}`;
    // 400/401 on a refresh means the grant itself is gone: a person has to reconnect.
    if (body.grant_type === "refresh_token" && (res.status === 400 || res.status === 401)) {
      throw new SquareAuthError(`Square refused the saved permission (${detail}).`);
    }
    throw new Error(`Square token request failed: ${detail}`);
  }
  return json;
}

export async function exchangeCode(code: string) {
  const { redirect } = oauthEnv();
  const t = await tokenCall({ grant_type: "authorization_code", code, redirect_uri: redirect });
  if (!t.refresh_token) throw new Error("Square did not return a refresh token.");
  return { accessToken: t.access_token!, refreshToken: t.refresh_token, merchantId: t.merchant_id ?? "" };
}

/** A fresh access token from the stored refresh token. Square's refresh token itself does not change. */
export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  const t = await tokenCall({ grant_type: "refresh_token", refresh_token: refreshToken });
  return { accessToken: t.access_token!, refreshToken: t.refresh_token ?? refreshToken };
}

/** Revokes every token this app holds for the merchant. Best effort; callers ignore failure. */
export async function revokeMerchant(merchantId: string): Promise<void> {
  const { id, secret } = oauthEnv();
  await fetch(new URL("/oauth2/revoke", squareBase()), {
    method: "POST",
    headers: { "Content-Type": "application/json", "Square-Version": SQUARE_VERSION, Authorization: `Client ${secret}` },
    body: JSON.stringify({ client_id: id, merchant_id: merchantId }),
  });
}

/* ── the API ── */

export function createSquareClient(accessToken: string): SquareClient {
  async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const res = await fetch(new URL(`/v2${path}`, squareBase()), {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Square-Version": SQUARE_VERSION,
        "Content-Type": "application/json",
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const json = (await res.json().catch(() => ({}))) as T & { errors?: { code?: string; detail?: string }[] };
    if (res.status === 401 || res.status === 403) {
      throw new SquareAuthError(`Square refused the request (${json.errors?.[0]?.code ?? res.status}).`);
    }
    if (!res.ok) {
      throw new Error(`Square ${path} failed: ${json.errors?.map((e) => e.code ?? e.detail).join(", ") || `HTTP ${res.status}`}`);
    }
    return json;
  }

  return {
    async merchant() {
      const r = await call<{ merchant?: { id: string; business_name?: string } }>("/merchants/me");
      return { id: r.merchant?.id ?? "", name: r.merchant?.business_name ?? "Square account" };
    },

    async locations() {
      const r = await call<{ locations?: { id: string; name?: string; status?: string; timezone?: string; currency?: string }[] }>("/locations");
      return (r.locations ?? []).map((l) => ({
        id: l.id, name: l.name ?? l.id, status: l.status ?? "ACTIVE", timezone: l.timezone ?? null, currency: l.currency ?? null,
      }));
    },

    async searchOrders({ locationIds, startAt, endAt, cursor }) {
      const r = await call<{ orders?: SquareOrder[]; cursor?: string }>("/orders/search", {
        method: "POST",
        body: {
          location_ids: locationIds,
          cursor,
          limit: 500,
          return_entries: false,
          query: {
            filter: {
              state_filter: { states: ["COMPLETED"] },
              date_time_filter: { closed_at: { start_at: startAt.toISOString(), end_at: endAt.toISOString() } },
            },
            // Square requires the sort field to match the date filter's field.
            sort: { sort_field: "CLOSED_AT", sort_order: "ASC" },
          },
        },
      });
      return { orders: r.orders ?? [], cursor: r.cursor || undefined };
    },

    async categoriesFor(variationIds) {
      const out = new Map<string, string>();
      const ids = [...new Set(variationIds)].filter(Boolean);
      if (!ids.length) return out;

      // Variation -> its parent item (returned alongside as a related object).
      type Obj = {
        id: string; type: string;
        item_variation_data?: { item_id?: string };
        item_data?: { category_id?: string; categories?: { id: string }[]; reporting_category?: { id: string } };
        category_data?: { name?: string };
      };
      const itemOf = new Map<string, string>();
      const categoryOfItem = new Map<string, string>();
      for (let i = 0; i < ids.length; i += 1000) {
        const r = await call<{ objects?: Obj[]; related_objects?: Obj[] }>("/catalog/batch-retrieve", {
          method: "POST",
          body: { object_ids: ids.slice(i, i + 1000), include_related_objects: true },
        });
        for (const o of r.objects ?? []) if (o.item_variation_data?.item_id) itemOf.set(o.id, o.item_variation_data.item_id);
        for (const o of r.related_objects ?? []) {
          const d = o.item_data;
          const cat = d?.reporting_category?.id ?? d?.categories?.[0]?.id ?? d?.category_id;
          if (o.type === "ITEM" && cat) categoryOfItem.set(o.id, cat);
        }
      }

      // Item -> category name. Categories are a second lookup: related objects
      // are one level deep, so a variation's related set holds its item, not
      // the item's category.
      const categoryIds = [...new Set(categoryOfItem.values())];
      const nameOf = new Map<string, string>();
      for (let i = 0; i < categoryIds.length; i += 1000) {
        const r = await call<{ objects?: Obj[] }>("/catalog/batch-retrieve", {
          method: "POST",
          body: { object_ids: categoryIds.slice(i, i + 1000), include_related_objects: false },
        });
        for (const o of r.objects ?? []) if (o.category_data?.name) nameOf.set(o.id, o.category_data.name);
      }

      for (const [variation, item] of itemOf) {
        const name = nameOf.get(categoryOfItem.get(item) ?? "");
        if (name) out.set(variation, name);
      }
      return out;
    },
  };
}
