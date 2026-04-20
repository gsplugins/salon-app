/**
 * Browser calls use same-origin `/api/*` so Next.js rewrites proxy to Laravel.
 */

export type ApiErrorBody = {
  message?: string;
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
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(init?.accessToken
      ? { Authorization: `Bearer ${init.accessToken}` }
      : {}),
    ...init?.headers,
  };
  const { accessToken, ...rest } = (init ?? {}) as RequestInit & { accessToken?: string };
  void accessToken;
  const res = await fetch(url, { ...rest, headers });
  const data = (await res.json().catch(() => ({}))) as T | ApiErrorBody;
  if (!res.ok) {
    return { ok: false, status: res.status, body: data as ApiErrorBody };
  }
  return { ok: true, status: res.status, data: data as T };
}

/** Shape returned by `GET /api/auth/me` (see Laravel AuthController::me). */
export type AuthMePayload = {
  id: number;
  name: string;
  mobile: string;
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

export function formatApiError(body: ApiErrorBody): string {
  if (body.message) return body.message;
  const errs = body.errors;
  if (errs && typeof errs === "object") {
    const first = Object.values(errs)[0];
    if (Array.isArray(first) && first[0]) return String(first[0]);
  }
  return "Request failed";
}
