# Salon frontend (Next.js)

Public marketing site and staff entry at [`/app`](./app/app/page.tsx). API calls go to the Node + Supabase API via Next rewrites and/or `NEXT_PUBLIC_API_URL`.

## Environment variables

Copy [`.env.example`](./.env.example) to `.env.local` for local development.

| Variable | Purpose |
|----------|---------|
| `BACKEND_URL` | API origin (no trailing slash). Powers `next.config.ts` rewrites: `/api/*` → `${BACKEND_URL}/api/*`. **Required on Vercel.** |
| `NEXT_PUBLIC_API_URL` | API base URL exposed to the browser/server (e.g. `https://api.example.com/api`). |
| `NEXT_PUBLIC_STAFF_LOGIN_URL` | Staff portal URL: same-site path (`/app`) or `https://app.example.com`. If unset, the header links to `/app`. |

## Deploy on Vercel

1. Connect the repo and set **Root Directory** to `frontend` if the monorepo root is not the Next app.
2. Add `BACKEND_URL`, `NEXT_PUBLIC_API_URL`, and optionally `NEXT_PUBLIC_STAFF_LOGIN_URL` in **Settings → Environment Variables**.
3. Redeploy after changing env vars (rewrites are resolved at build time).

Native **mobile apps** should call the JSON API **directly** (not rely on Next rewrites). See [`../docs/FEATURES.md`](../docs/FEATURES.md) for auth (mobile + password, SMS OTP reset, JWT / refresh) and hosting notes.

## Local development

From `frontend/`:

```bash
npm install
npm run dev
```

From the monorepo root (after `npm install` inside `frontend/`): `npm run dev:web`.

Open **`http://127.0.0.1:3000`** (or set `PORT` in the environment, e.g. `PORT=3001 npm run dev`).

**`Another next dev server is already running`:** Next 16 allows **one** `next dev` for this folder. Stop the old one: use the PID in the message, e.g. `taskkill /PID 14448 /F`, or close that terminal. If no process is running but the error persists, run **`npm run dev:refresh`** (clears `.next/dev` then starts dev).

**`listen EADDRINUSE`:** Something else is using that port—free it (`netstat -ano | findstr :3000` then `taskkill /PID <pid> /F`) or set **`PORT=3001`** for this run only.

If the browser says **“This site can’t be reached”**, the dev server is not running or you opened the wrong port—match the port from the terminal.

Run the API separately (`backend-supabase` or root `npm run dev:api`).
