/**
 * Browser calls use same-origin `/api/*` handled by Next App Router API routes.
 */

import { getSalonActAsShopSlug, SALON_ACT_AS_SHOP_SLUG_HEADER } from "@/lib/salon-act-as-shop";
import { getStaffActAsStaffId, SALON_ACT_AS_STAFF_ID_HEADER } from "@/lib/staff-act-as";

export type ApiErrorBody = {
  message?: string;
  /** Extra context from the API (e.g. Postgres / Supabase error text). */
  detail?: string;
  /** Optional actionable hint from the API (e.g. schema / env). */
  hint?: string;
  errors?: Record<string, string[]>;
};

export async function authJson<T = unknown>(
  path: string,
  init?: RequestInit & { accessToken?: string }
): Promise<
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; body: ApiErrorBody }
> {
  const url = path.startsWith("/api") ? path : `/api${path.startsWith("/") ? path : `/${path}`}`;
  const actSlug = getSalonActAsShopSlug();
  const actStaff =
    url.includes("/api/staff") || url.includes("/api/my/barber") ? getStaffActAsStaffId() : null;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(init?.accessToken
      ? { Authorization: `Bearer ${init.accessToken}` }
      : {}),
    ...(actSlug ? { [SALON_ACT_AS_SHOP_SLUG_HEADER]: actSlug } : {}),
    ...(actStaff ? { [SALON_ACT_AS_STAFF_ID_HEADER]: actStaff } : {}),
    ...init?.headers,
  };
  const { accessToken, ...rest } = (init ?? {}) as RequestInit & { accessToken?: string };
  void accessToken;

  const parseBody = (res: Response, text: string): { data: unknown; jsonOk: boolean } => {
    if (!text) return { data: {}, jsonOk: true };
    try {
      return { data: JSON.parse(text) as T | ApiErrorBody, jsonOk: true };
    } catch {
      const preview = text.replace(/\s+/g, " ").trim().slice(0, 500) || "(empty body)";
      return {
        data: {
          message:
            res.status >= 400
              ? `Server returned non-JSON (${res.status}). The Next.js API route failed before returning JSON.`
              : preview.slice(0, 200),
          detail: preview,
        } as ApiErrorBody,
        jsonOk: false,
      };
    }
  };

  try {
    const res = await fetch(url, { ...rest, headers });
    const text = await res.text();
    const { data, jsonOk } = parseBody(res, text);

    if (!res.ok) {
      return { ok: false, status: res.status, body: data as ApiErrorBody };
    }
    if (!jsonOk) {
      return {
        ok: false,
        status: res.status,
        body: data as ApiErrorBody,
      };
    }
    return { ok: true, status: res.status, data: data as T };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    const hint =
      msg === "Failed to fetch" || msg.includes("NetworkError")
        ? "Cannot reach API route. Make sure Next.js server is running and env vars are configured."
        : msg;
    return { ok: false, status: 0, body: { message: hint } };
  }
}

/** Shape returned by `GET /api/auth/me`. */
export type AuthMePayload = {
  id: string;
  name: string;
  mobile: string;
  photo_url?: string | null;
  role: string;
  /** `super_admin` | `user` — platform vs normal account. */
  global_role?: string;
  loyalty_points?: number;
  is_super_admin: boolean;
  is_shop_owner: boolean;
  /** Operational manager (per-shop); subscription/billing hidden server-side. */
  is_manager?: boolean;
  is_barber: boolean;
  is_admin: boolean;
  /** Resolved role for the active management shop (owner | manager | barber | super_admin). */
  shop_access?: { shop_id: number | null; role: string | null };
  shop: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    is_active: boolean;
  } | null;
  subscription: {
    status: string;
    plan_key: string;
    trial_ends_at: string | null;
    current_period_end: string | null;
  } | null;
};

type AuthMeResult =
  | { ok: true; data: AuthMePayload }
  | { ok: false; status: number; body: ApiErrorBody };

const AUTH_ME_CACHE_TTL_MS = 2500;
const authMeCache = new Map<string, { expiresAt: number; result: AuthMeResult }>();
const authMeInFlight = new Map<string, Promise<AuthMeResult>>();

function clearAuthMeCache(accessToken?: string): void {
  if (accessToken) {
    authMeCache.delete(accessToken);
    authMeInFlight.delete(accessToken);
    return;
  }
  authMeCache.clear();
  authMeInFlight.clear();
}

export async function fetchAuthMe(
  accessToken: string,
  opts?: { force?: boolean }
): Promise<AuthMeResult> {
  const force = opts?.force === true;
  if (!force) {
    const cached = authMeCache.get(accessToken);
    if (cached && cached.expiresAt > Date.now()) return cached.result;
    const pending = authMeInFlight.get(accessToken);
    if (pending) return pending;
  }

  const request = authJson<AuthMePayload>("/auth/me", { accessToken }).then((res) => {
    if (!res.ok && (res.status === 401 || res.status === 403)) {
      clearAuthMeCache(accessToken);
      return res;
    }
    authMeCache.set(accessToken, {
      expiresAt: Date.now() + AUTH_ME_CACHE_TTL_MS,
      result: res,
    });
    return res;
  }).finally(() => {
    authMeInFlight.delete(accessToken);
  });

  authMeInFlight.set(accessToken, request);
  return request;
}

export async function patchAuthMe(
  accessToken: string,
  body: { name?: string; photo_url?: string | null }
): Promise<{ ok: true; data: Pick<AuthMePayload, "id" | "name" | "mobile" | "photo_url" | "role"> } | { ok: false; status: number; body: ApiErrorBody }> {
  const res = await authJson("/auth/me", { method: "PATCH", accessToken, body: JSON.stringify(body) });
  clearAuthMeCache(accessToken);
  return res;
}

export async function uploadAuthProfilePhoto(
  accessToken: string,
  dataUrl: string
): Promise<{ ok: true; data: { url: string; path: string } } | { ok: false; status: number; body: ApiErrorBody }> {
  const res = await authJson<{ url: string; path: string } | { data: { url: string; path: string } }>("/auth/me/photo-upload", {
    method: "POST",
    accessToken,
    body: JSON.stringify({ data_url: dataUrl }),
  });
  if (!res.ok) return res;
  clearAuthMeCache(accessToken);
  const payload = (res.data as { data?: { url?: string; path?: string }; url?: string; path?: string }) ?? {};
  const directUrl = typeof payload.url === "string" ? payload.url : "";
  const directPath = typeof payload.path === "string" ? payload.path : "";
  const nestedUrl = typeof payload.data?.url === "string" ? payload.data.url : "";
  const nestedPath = typeof payload.data?.path === "string" ? payload.data.path : "";
  const url = directUrl || nestedUrl;
  const path = directPath || nestedPath;
  if (!url || !path) {
    return { ok: false, status: 500, body: { message: "Upload succeeded but response format was invalid." } };
  }
  return { ok: true, data: { url, path } };
}

export function formatApiError(body: ApiErrorBody): string {
  const hint = body.hint ? ` ${body.hint}` : "";
  if (body.message && body.detail) return `${body.message} ${body.detail}${hint}`;
  if (body.message) return `${body.message}${hint}`;
  if (body.detail) return body.detail;
  const errs = body.errors;
  if (errs && typeof errs === "object") {
    const e = errs as {
      fieldErrors?: Record<string, string[] | undefined>;
      formErrors?: string[];
      [key: string]: unknown;
    };
    if (e.fieldErrors) {
      for (const arr of Object.values(e.fieldErrors)) {
        if (Array.isArray(arr) && arr[0]) return String(arr[0]);
      }
    }
    if (Array.isArray(e.formErrors) && e.formErrors[0]) return String(e.formErrors[0]);
    for (const [k, v] of Object.entries(e)) {
      if (k === "fieldErrors" || k === "formErrors") continue;
      if (Array.isArray(v) && v[0]) return String(v[0]);
    }
  }
  return "Request failed";
}
