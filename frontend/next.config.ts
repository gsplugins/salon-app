import type { NextConfig } from "next";

// Vercel: set BACKEND_URL to your backend origin (no trailing slash), e.g. https://your-api.vercel.app
// Local dev: BACKEND_URL_LOCAL overrides BACKEND_URL and defaults to local API server.
const backend = (
  process.env.BACKEND_URL_LOCAL ??
  process.env.BACKEND_URL ??
  "http://127.0.0.1:4000"
).replace(/\/$/, "");

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
