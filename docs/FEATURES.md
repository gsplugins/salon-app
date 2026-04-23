# Salon app — features & platform notes

This document captures agreed product behavior and constraints for the **marketing site (Next.js)**, **HTTPS JSON API** (`backend-supabase`, Node + Supabase), future **mobile apps**, and **Vercel** hosting.

---

## Authentication (Node API)

Base path: **`/api`** (e.g. `POST https://api.example.com/api/auth/login`).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/register` | — | `mobile`, `password`, `password_confirmation`, optional `name`. No email. |
| `POST` | `/auth/login` | — | `mobile`, `password`. |
| `POST` | `/auth/refresh` | — | `refresh_token` — rotates refresh token; returns new access + refresh. |
| `POST` | `/auth/logout` | Bearer JWT | Optional `refresh_token` to revoke one token; omit to revoke all refresh tokens for the user. |
| `GET` | `/auth/me` | Bearer JWT | `id`, `name`, `mobile`, role flags. |
| `POST` | `/auth/forgot-password` | — | `mobile` — SMS OTP (dev may log OTP). Same JSON message whether user exists. |
| `POST` | `/auth/reset-password` | — | `mobile`, `otp`, `password`, `password_confirmation`. |

**Tokens:** `access_token` (JWT HS256, configurable TTL), `expires_in` (seconds), opaque `refresh_token` (server-side). Set **`JWT_SECRET`** (and Supabase keys) on the API host — see `backend-supabase/README.md`.

**Mobiles:** normalized to **digits only** for storage and lookup.

### Product rules

- **Identifier:** mobile (no email required).
- **Password reset:** 6-digit OTP by SMS; short validity window (configure in API / DB).
- **Refresh:** rotation on each `/auth/refresh` call; logout revokes refresh token(s).

### Admin / staff entry points

| Deployment | Staff login URL |
|------------|-----------------|
| **Paired with public website** | Expose an **admin / staff login** entry from the site (e.g. header or footer **“Staff login”**). The target URL is configurable so it can point at the same Next deployment path or a separate host. |
| **System-only (no public marketing site)** | Login portal at **`app.yourdomain.com`** *or* **`yourdomain.com/app`**. |

Implementation detail: the Next.js app uses `NEXT_PUBLIC_STAFF_LOGIN_URL` (see `frontend` env examples). If unset, the UI defaults to same-origin **`/app`**.

---

## Vercel (Next.js frontend)

- **Rewrites:** `next.config.ts` proxies `/api/*` to the Node API using **`BACKEND_URL`**. On Vercel, set **`BACKEND_URL`** to your API’s public base URL (no trailing slash), e.g. `https://api.yourdomain.com`.
- **Client-side / SSR direct API calls** use **`NEXT_PUBLIC_API_URL`** (typically `https://api.yourdomain.com/api`). Restart the dev server or redeploy after changing public env vars.
- **Secrets** (SMS keys, JWT signing keys, Supabase service role) stay on the **API** host — never commit them to the frontend repo.

---

## Mobile app (future)

- **Same API** as the web app: mobile clients should call the API **directly** (HTTPS), not rely on Next.js rewrites (rewrites are for browser same-origin only).
- **Auth:** store access + refresh tokens using **platform secure storage** (Keychain / Keystore); send `Authorization: Bearer <access_token>`; refresh before expiry using the refresh endpoint.
- **CORS** is irrelevant to native apps; ensure **TLS**, **certificate pinning** (optional), and **rate limiting** on auth endpoints.
- Align **token lifetime** and **refresh** behavior with the API so web and mobile stay consistent.

---

## Revision

Update this file when auth flows, URLs, or hosting split (e.g. separate `app.` subdomain) change.

Test accounts for local development are defined in `backend-supabase/supabase/seed.sql` — **change or remove them before production**.


Super Admin :
mobile : 01711111111
pas : Admin@12345
