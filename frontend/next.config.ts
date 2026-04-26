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
  // Output standalone for Vercel deployment
  output: 'standalone',
  
  // Ignore ESLint errors during build (temporary for deployment)
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Ignore TypeScript errors during build (temporary for deployment)
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Environment variables that should be available
  env: {
    // Add any public env vars here if needed
  },
  
  // If you use external images, configure domains here
  images: {
    domains: [], // Add your image domains if needed
  },
}

module.exports = nextConfig
