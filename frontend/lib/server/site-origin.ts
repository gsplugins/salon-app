/**
 * Absolute origin for same-origin server fetches (RSC → App Router `/api/*`).
 * Set `SITE_URL` on Vercel (e.g. https://your-app.vercel.app) for reliable cron / ISR fetches.
 */
export function getServerSiteOrigin(): string {
  const explicit = process.env.SITE_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  const port = process.env.PORT || "3000";
  return `http://127.0.0.1:${port}`;
}
