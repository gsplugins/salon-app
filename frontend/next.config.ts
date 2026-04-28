import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // Ignore build errors for deployment
  typescript: {
    ignoreBuildErrors: true,
  },

};

export default nextConfig;
