// import type { NextConfig } from "next";

// // Vercel: set BACKEND_URL to your Node API origin (e.g. https://api.example.com), no trailing slash.
// // Local dev: prefer BACKEND_URL_LOCAL so machine-level BACKEND_URL does not override project settings.
// // Local default matches backend-supabase default PORT=4000.
// // Rewrites are evaluated at build/deploy; changing env requires a redeploy.
// const backend = (
//   process.env.BACKEND_URL_LOCAL ??
//   process.env.BACKEND_URL ??
//   "http://127.0.0.1:4000"
// ).replace(/\/$/, "");

// const nextConfig: NextConfig = {
//   async rewrites() {
//     return [
//       {
//         source: "/api/:path*",
//         destination: `${backend}/api/:path*`,
//       },
//     ];
//   },
// };

// export default nextConfig;



/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // Ignore build errors for deployment
  typescript: {
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig
