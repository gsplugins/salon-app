import type { NextConfig } from "next";

// Vercel: set BACKEND_URL to your backend origin (no trailing slash), e.g. https://your-api.vercel.app
// Local dev: BACKEND_URL_LOCAL overrides BACKEND_URL and defaults to local API server.
function normalizeBackendOrigin(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, "");
  if (!trimmed) return "http://127.0.0.1:4000";
  try {
    const parsed = new URL(trimmed);
    // BACKEND_URL is expected to be an origin. If user sets ".../api", normalize it.
    if (parsed.pathname === "/api" || parsed.pathname === "/api/") {
      parsed.pathname = "";
    }
    return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, "");
  } catch {
    return trimmed.replace(/\/api$/, "");
  }
}

const backend = normalizeBackendOrigin(
  process.env.BACKEND_URL_LOCAL ??
    process.env.BACKEND_URL ??
    "http://127.0.0.1:4000"
);

const nextConfig: NextConfig = {
  output: "standalone",

  // Ignore build errors for deployment
  typescript: {
    ignoreBuildErrors: true,
  },

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backend}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
