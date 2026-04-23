# Deploy Checklist (Supabase + Vercel)

Use this checklist when deploying the Supabase + Node API stack.

## 1) Supabase setup

- Create Supabase project.
- Run SQL files in order:
  1. `supabase/schema.sql`
  2. `supabase/seed.sql`
- Verify tables exist:
  - `users`, `shops`, `subscriptions`, `salon_*`, `staff_*`
  - `platform_general`, `subscription_plans`, `notification_templates`
  - `admin_webhooks`, `audit_logs`, `bkash_payments`, `password_reset_otps`
- Update default super admin in `seed.sql` for production.

## 2) Backend deploy (Vercel project: `backend-supabase`)

- Root directory: `backend-supabase`
- Framework preset: Other
- Build command: `npm run build`
- Output directory: default
- Node version: 20+

Set environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET` (long random string)
- `JWT_ACCESS_TTL_SECONDS` (recommended `604800`)
- `JWT_REFRESH_TTL_SECONDS` (recommended `2592000`)

After deploy:

- Open `https://<backend-domain>/api/test` and verify JSON response.

## 3) Frontend deploy (Vercel project: `frontend`)

- Root directory: `frontend`
- Build command: default Next.js build

Set environment variables:

- `BACKEND_URL=https://<backend-domain>`

Redeploy frontend after changing `BACKEND_URL`.

## 4) Smoke tests (must pass)

- Auth:
  - register customer
  - register shop owner
  - login / refresh / logout
  - forgot password / reset password
- Owner:
  - profile, services, staff, bookings, queue, inventory
- Staff:
  - dashboard, appointments, schedule, availability, profile
- Admin/System:
  - subscription plans, integrations, users, shops, billing tables

## 5) Security checks before production

- Rotate any temporary credentials used in dev.
- Replace seeded super-admin mobile/password hash.
- Set strong `JWT_SECRET`.
- Restrict Supabase project access and review API keys.
- Add backup policy for Supabase database.

## 6) Production cutover

- Set `BACKEND_URL` / `NEXT_PUBLIC_API_URL` on Vercel (and any other frontends) to this API’s public URL.
- Monitor auth errors, 4xx/5xx rates, and critical flows after deploy.
- Roll back env vars to a previous API URL only if you still run a separate fallback instance.
