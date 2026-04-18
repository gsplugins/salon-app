import type { NextConfig } from "next";

// Vercel: set BACKEND_URL to your Laravel API origin (e.g. https://api.example.com).
// Rewrites are evaluated at build/deploy; changing env requires a redeploy.
const backend = (
  process.env.BACKEND_URL ?? "http://127.0.0.1:8000"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
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
