/**
 * Browser calls use same-origin `/api/*` so Next.js rewrites proxy to the Node API (`BACKEND_URL`).
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

function normalizeApiBase(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, "");
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname === "" || parsed.pathname === "/") {
      parsed.pathname = "/api";
    } else if (!parsed.pathname.endsWith("/api")) {
      parsed.pathname = `${parsed.pathname.replace(/\/$/, "")}/api`;
    }
    return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, "");
  } catch {
    return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
  }
}

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

  const directBaseFromEnv =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL
      ? normalizeApiBase(String(process.env.NEXT_PUBLIC_API_URL))
      : "";
  const localDirectFallback =
    typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)
      ? "http://127.0.0.1:4000/api"
      : "";
  const directBase = directBaseFromEnv || localDirectFallback;
  const isAbsoluteUrl = /^https?:\/\//i.test(url);
  const shouldPreferDirect =
    Boolean(directBase) &&
    !isAbsoluteUrl &&
    (typeof window !== "undefined" ? !/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname) : true);
  const toDirectUrl = (sameOriginApiPath: string): string | null => {
    if (!directBase) return null;
    const p = sameOriginApiPath.startsWith("/api") ? sameOriginApiPath : `/api${sameOriginApiPath.startsWith("/") ? sameOriginApiPath : `/${sameOriginApiPath}`}`;
    const restPath = p.replace(/^\/api/, "") || "/";
    const suffix = restPath.startsWith("/") ? restPath : `/${restPath}`;
    return `${directBase}${suffix}`;
  };

  const parseBody = (res: Response, text: string): { data: unknown; jsonOk: boolean } => {
    if (!text) return { data: {}, jsonOk: true };
    try {
      return { data: JSON.parse(text) as T | ApiErrorBody, jsonOk: true };
    } catch {
      const preview = text.replace(/\s+/g, " ").trim().slice(0, 500) || "(empty body)";
      const proxyLikely =
        res.status >= 500 &&
        (preview.includes("Internal Server Error") ||
          preview.includes("<!DOCTYPE") ||
          preview.includes("<html") ||
          preview.length < 80);
      const fallbackHint = directBase
        ? ` With NEXT_PUBLIC_API_URL set, the client will try that URL if the proxy response is not JSON.`
        : " Add NEXT_PUBLIC_API_URL in frontend/.env.local (e.g. http://127.0.0.1:4000/api) so the app can call the API directly when the Next.js /api proxy returns HTML.";
      return {
        data: {
          message:
            res.status >= 400
              ? `Server returned non-JSON (${res.status}). The Next.js → API proxy may be failing (BACKEND_URL in next.config).${proxyLikely ? fallbackHint : ""}`
              : preview.slice(0, 200),
          detail: preview,
        } as ApiErrorBody,
        jsonOk: false,
      };
    }
  };

  try {
    const run = async (target: string) => {
      const res = await fetch(target, { ...rest, headers });
      const text = await res.text();
      const { data, jsonOk } = parseBody(res, text);
      return { res, text, data, jsonOk };
    };

    const direct = toDirectUrl(url);
    let { res, data, jsonOk } = await run(shouldPreferDirect && direct ? direct : url);

    // If first call was direct and failed hard, try same-origin /api as fallback.
    if (
      shouldPreferDirect &&
      direct &&
      (res.status === 404 || res.status === 405 || res.status >= 500)
    ) {
      try {
        const second = await run(url);
        res = second.res;
        data = second.data;
        jsonOk = second.jsonOk;
      } catch {
        // keep first error body
      }
    }

    // If first call was same-origin and proxy likely failed, retry direct API URL.
    if (
      !shouldPreferDirect &&
      direct &&
      ((!jsonOk && res.status >= 500) || res.status === 404 || res.status === 405 || res.status === 502 || res.status === 503 || res.status === 504)
    ) {
      try {
        const second = await run(direct);
        res = second.res;
        data = second.data;
        jsonOk = second.jsonOk;
      } catch {
        // keep first error body
      }
    }

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
        ? "Cannot reach API. Run backend-supabase on port 4000 and set BACKEND_URL=http://127.0.0.1:4000 in frontend/.env.local (restart Next.js after)."
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

export async function fetchAuthMe(
  accessToken: string
): Promise<{ ok: true; data: AuthMePayload } | { ok: false; status: number; body: ApiErrorBody }> {
  return authJson<AuthMePayload>("/auth/me", { accessToken });
}

export async function patchAuthMe(
  accessToken: string,
  body: { name?: string; photo_url?: string | null }
): Promise<{ ok: true; data: Pick<AuthMePayload, "id" | "name" | "mobile" | "photo_url" | "role"> } | { ok: false; status: number; body: ApiErrorBody }> {
  return authJson("/auth/me", { method: "PATCH", accessToken, body: JSON.stringify(body) });
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
