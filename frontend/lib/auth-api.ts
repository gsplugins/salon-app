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
  const { accessToken: _a, ...rest } = init ?? {};
  const res = await fetch(url, { ...rest, headers });
  const data = (await res.json().catch(() => ({}))) as T | ApiErrorBody;
  if (!res.ok) {
    return { ok: false, status: res.status, body: data as ApiErrorBody };
  }
  return { ok: true, status: res.status, data: data as T };
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
