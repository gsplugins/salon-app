# Salon frontend (Next.js)

Public marketing site and staff entry at [`/app`](./app/app/page.tsx). API calls go to Laravel via rewrites and/or `NEXT_PUBLIC_API_URL`.

## Environment variables

Copy [`.env.example`](./.env.example) to `.env.local` for local development.

| Variable | Purpose |
|----------|---------|
| `BACKEND_URL` | Laravel origin (no trailing slash). Powers `next.config.ts` rewrites: `/api/*` → Laravel. **Required on Vercel.** |
| `NEXT_PUBLIC_API_URL` | API base URL exposed to the browser/server (e.g. `https://api.example.com/api`). |
| `NEXT_PUBLIC_STAFF_LOGIN_URL` | Staff portal URL: same-site path (`/app`) or `https://app.example.com`. If unset, the header links to `/app`. |

## Deploy on Vercel

1. Connect the repo and set **Root Directory** to `frontend` if the monorepo root is not the Next app.
2. Add `BACKEND_URL`, `NEXT_PUBLIC_API_URL`, and optionally `NEXT_PUBLIC_STAFF_LOGIN_URL` in **Settings → Environment Variables**.
3. Redeploy after changing env vars (rewrites are resolved at build time).

Native **mobile apps** should call the Laravel API **directly** (not rely on Next rewrites). See [`../docs/FEATURES.md`](../docs/FEATURES.md) for auth (mobile + password, SMS OTP reset, JWT / refresh) and hosting notes.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
