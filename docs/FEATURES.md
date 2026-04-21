# Salon app — features & platform notes

This document captures agreed product behavior and constraints for the **marketing site (Next.js)**, **API (Laravel)**, future **mobile apps**, and **Vercel** hosting.

---

## Authentication (Laravel API)

Base path: **`/api`** (e.g. `POST https://api.example.com/api/auth/login`).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/register` | — | `mobile`, `password`, `password_confirmation`, optional `name`. No email. |
| `POST` | `/auth/login` | — | `mobile`, `password`. |
| `POST` | `/auth/refresh` | — | `refresh_token` — rotates refresh token; returns new access + refresh. |
| `POST` | `/auth/logout` | Bearer JWT | Optional `refresh_token` to revoke one token; omit to revoke all refresh tokens for the user. |
| `GET` | `/auth/me` | Bearer JWT | `id`, `name`, `mobile`, `is_admin`. |
| `POST` | `/auth/forgot-password` | — | `mobile` — SMS OTP (`SMS_DRIVER=log` in dev). Same JSON message whether user exists. |
| `POST` | `/auth/reset-password` | — | `mobile`, `otp`, `password`, `password_confirmation`. |

**Tokens:** `access_token` (JWT HS256, default **7-day** TTL), `expires_in` (seconds), opaque `refresh_token` (server-side, default **30-day** lifetime). Set **`JWT_SECRET`** in production (`backend/.env.example`).

**Mobiles:** normalized to **digits only** for storage and lookup.

### Product rules

- **Identifier:** mobile (no email required; `users.email` is nullable).
- **Password reset:** 6-digit OTP by SMS; **15-minute** validity.
- **Refresh:** rotation on each `/auth/refresh` call; logout revokes refresh token(s).

### Admin / staff entry points

| Deployment | Staff login URL |
|------------|-----------------|
| **Paired with public website** | Expose an **admin / staff login** entry from the site (e.g. header or footer **“Staff login”**). The target URL is configurable so it can point at the same Next deployment path or a separate host. |
| **System-only (no public marketing site)** | Login portal at **`app.yourdomain.com`** *or* **`yourdomain.com/app`**. |

Implementation detail: the Next.js app uses `NEXT_PUBLIC_STAFF_LOGIN_URL` (see `frontend/.env.example`). If unset, the UI defaults to same-origin **`/app`**.

---

## Vercel (Next.js frontend)

- **Rewrites:** `next.config.ts` proxies `/api/*` to the Laravel API using **`BACKEND_URL`**. On Vercel, set **`BACKEND_URL`** to your API’s public base URL (no trailing slash), e.g. `https://api.yourdomain.com`.
- **Client-side / SSR direct API calls** use **`NEXT_PUBLIC_API_URL`** (typically `https://api.yourdomain.com/api` or your API path). Restart the dev server or redeploy after changing public env vars.
- **Secrets** (SMS keys, JWT signing keys, DB) stay on the **Laravel** server or serverless backend — never commit them to the frontend repo.

---

## Mobile app (future)

- **Same API** as the web app: mobile clients should call the Laravel API **directly** (HTTPS), not rely on Next.js rewrites (rewrites are for browser same-origin only).
- **Auth:** store access + refresh tokens using **platform secure storage** (Keychain / Keystore); send `Authorization: Bearer <access_token>`; refresh before expiry using the refresh endpoint.
- **CORS** is irrelevant to native apps; ensure **TLS**, **certificate pinning** (optional), and **rate limiting** on auth endpoints.
- Align **token lifetime (7 days)** and **refresh** behavior with the API so web (if cookie-based later) and mobile stay consistent.

---

## Revision

Update this file when auth flows, URLs, or hosting split (e.g. separate `app.` subdomain) change.

SuperAdmin : 5550000000
pass : password

customer : 01762933844
pass: customer@@@123

cus 2 : 01762933855
pass : 01762933844pass

shop: 01762933800
pass : shop@@@123

staff: 01762933822
pass: 1762933822staff