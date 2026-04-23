# backend-supabase

Supabase + Node.js HTTPS JSON API for the salon product (Next.js and future mobile clients).

## Current status

- Implemented:
  - `GET /api/test`
  - `POST /api/auth/register`
  - `POST /api/auth/register-barber`
  - `POST /api/auth/login`
  - `POST /api/auth/refresh`
  - `POST /api/auth/logout`
  - `POST /api/auth/change-password`
  - `GET /api/auth/me` (shop + subscription context when applicable)
  - `GET /api/public/shops`
  - `GET /api/public/shops/:shopId`
  - `GET /api/public/barbers/:staffId`
  - `GET /api/public/shops/:shopId/queue`
  - `POST /api/public/shops/:shopId/queue/join`
  - `GET /api/shops/:slug/meta`
  - `GET /api/shops/:slug/services`
  - `GET /api/shops/:slug/staff`
  - `GET /api/shops/:slug/availability` (temporary slot logic)
  - `POST /api/shops/:slug/bookings`
- Owner salon management (`Authorization: Bearer`, optional `X-Salon-Act-As-Shop-Slug`):
  - `GET/PATCH /api/my/shop/profile`
  - `GET /api/my/shop/stats`
  - `GET /api/my/shop/clients`
  - `GET/POST/PATCH/DELETE /api/my/shop/services-catalog` (+ `/:serviceId`)
  - `GET/POST/PATCH/DELETE /api/my/shop/staff-catalog` (+ `/:staffId`)
  - `POST /api/my/shop/staff-with-account`
  - `GET/POST/PATCH /api/my/shop/bookings` (+ `/:bookingId`)
  - `GET/POST/DELETE /api/my/shop/blocked-slots` (+ `/:id`)
  - `GET/POST/PATCH /api/my/shop/branches` (+ `/:shopId`)
  - `GET/POST/PATCH/DELETE /api/my/shop/inventory` (+ `/:id`)
  - `GET/PATCH /api/my/shop/reviews` (+ `/:reviewId`)
  - `GET /api/my/shop/analytics/summary`
  - `GET/POST/PATCH /api/my/shop/payments` (+ `/:payment/refund`)
  - `GET /api/my/shop/queue/manage`, `PATCH /api/my/shop/queue/:id/status`
- Customer:
  - `GET /api/me/appointments`
  - `GET /api/me/loyalty`
  - `PATCH /api/me/bookings/:bookingId`
- Staff + barber:
  - `GET /api/my/barber/today`
  - `GET /api/my/barber/history`
  - `GET /api/staff/dashboard`
  - `GET/PATCH /api/staff/appointments` (+ `/:bookingId`)
  - `POST /api/staff/appointments/:bookingId/reschedule-request`
  - `GET /api/staff/schedule`
  - `GET/POST /api/staff/leave-requests`
  - `GET /api/staff/customers`
  - `GET /api/staff/customers/:mobile/history`
  - `GET /api/staff/customers/:mobile/notes`
  - `POST /api/staff/customer-notes`
  - `GET /api/staff/services`
  - `GET /api/staff/earnings/summary`
  - `GET /api/staff/notifications`
  - `PATCH /api/staff/notifications/:notification/read`
  - `POST /api/staff/notifications/read-all`
  - `DELETE /api/staff/notifications`
  - `PATCH /api/staff/notification-preferences`
  - `GET/PATCH /api/staff/availability`
  - `GET/POST/DELETE /api/staff/availability/blocks` (+ `/:block`)
  - `GET /api/staff/reviews`
  - `GET/PATCH /api/staff/profile`
- Not yet ported:
  - Most endpoints are now ported; remaining gap is behavior parity hardening.

- Admin (`super_admin`):
  - `GET/PATCH /api/admin/general`
  - `GET/POST/PATCH/DELETE /api/admin/subscription-plans` (+ `/:plan`)
  - `PATCH /api/admin/shops/:shop/subscription`
  - `GET /api/admin/audit-logs`
  - `GET /api/admin/audit-logs/export` (CSV)
  - `GET/PATCH /api/admin/notification-templates` (+ `/:template`)
  - `PATCH /api/admin/notification-toggles`
  - `GET /api/admin/integrations`
  - `PATCH /api/admin/integrations/{stripe|smtp|sms|google-calendar|whatsapp}`
  - `GET/POST/PATCH/DELETE /api/admin/webhooks` (+ `/:webhook`)
  - `POST /api/admin/webhooks/:webhook/test`
  - `GET /api/admin/analytics/summary`
  - `GET /api/admin/permissions`
  - `PUT /api/admin/permissions`
  - `POST /api/admin/users/:user/impersonate`
  - `DELETE /api/admin/users/:user`
  - `GET /api/admin/billing/bkash`
  - `GET /api/admin/billing/salon-payments`
  - `PATCH /api/admin/billing/bkash/:payment/refund`
  - `PATCH /api/admin/billing/salon-payments/:salon_payment/refund`
  - `GET /api/admin/billing/salon-payments/:salon_payment/invoice`

- System (`super_admin`):
  - `GET/POST/PATCH/DELETE /api/system/shops` (+ `/:id`)
  - `GET /api/system/users`
  - `PATCH /api/system/users/:user`
  - `POST /api/system/users/:user/reset-password`
  - `POST /api/system/subscriptions/:subscription/extend`
  - `PATCH /api/system/subscriptions/:subscription`
  - `GET/POST /api/system/bkash-payments`

## Database migrations

Migrations are versioned SQL under `supabase/migrations/`. The first file matches `supabase/schema.sql` (idempotent `IF NOT EXISTS` style).

**Option A — Supabase CLI against your hosted project (recommended)**

From `backend-supabase/`:

1. Install the [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) if you have not already.
2. `npx supabase login`
3. `npx supabase link --project-ref <your-project-ref>` (Dashboard → Project Settings → General → Reference ID).
4. `npm run db:push` — applies pending migrations to the linked database.

**Option B — Dashboard (no CLI)**

In Supabase → **SQL Editor**, run `supabase/schema.sql` (same as the initial migration), then run `supabase/seed.sql` if you want seed data.

**Local Supabase (Docker)**

`npx supabase start`, then `npm run db:reset` migrates and runs `supabase/seed.sql` per `config.toml`.

Useful scripts: `npm run db:new <name>`, `npm run db:push`, `npm run db:reset`, `npm run db:diff`.

## Setup

1. Create a Supabase project.
2. Apply the schema using **Database migrations** above (CLI `db:push` or paste `supabase/schema.sql` in the SQL editor).
3. Run `supabase/seed.sql` for first-time bootstrap (super admin + defaults), unless `db:reset` already applied it locally.
4. Copy `.env.example` to `.env` in this folder and set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (service_role, not anon), and `JWT_SECRET`. Optional overrides: `.env.local` (same keys). Env files are loaded from this package directory even if you run npm from the monorepo root.
5. Install and run:

```bash
cd backend-supabase
npm install
npm run dev
```

Or from the repo root: `npm run dev:api` (see root `package.json`). Server listens on `http://127.0.0.1:4000` by default (`PORT` in `.env` to change).

## Frontend integration

In Vercel (frontend project), set:

- `BACKEND_URL=https://<your-backend-domain>`

The existing frontend rewrite in `next.config.ts` keeps `/api/*` calls unchanged.

## Deploy to Vercel

You can deploy this service as a separate Vercel project:

- Root directory: `backend-supabase`
- Build command: `npm run build`
- Output: leave default
- Start command: `npm run start`

Add environment variables from `.env`.

For production rollout steps, see `DEPLOY_CHECKLIST.md`.

## First admin login

- Seed creates one default super admin user.
- **Mobile:** `01711111111`, `8801711111111`, or `+8801711111111` (frontend and API normalize to `+8801711111111`). Avoid a leading `+` only with the wrong digit count (e.g. 10 digits without `0`).
- **Password:** `Admin@12345` (matches the bcrypt in `supabase/seed.sql`). Leading/trailing spaces are trimmed on login.
- If you already ran an older `seed.sql` and login fails, apply `supabase/migrations/20260423140000_fix_super_admin_password_hash.sql` in the SQL editor (or `npm run db:push` so migrations run).
- Change mobile and password in `supabase/seed.sql` before production use.

## Rollout / parity

1. Verify auth (web and any mobile clients) end-to-end.
2. Exercise public + booking flows against production-like data.
3. Exercise owner `/api/my/shop/*`, customer, and staff modules.
4. Run parity checks and tune edge-case logic per page before treating the API as canonical for a shop.
