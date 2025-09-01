import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Heroku deployment optimizations
  output: 'standalone',
  experimental: {
    // Disable lightningcss to avoid binary loading issues
    optimizeCss: false,
  },
  // Ensure proper static file handling
  trailingSlash: false,
  // Server external packages moved to root level in Next.js 15
  serverExternalPackages: [],
  // Disable ESLint during build for deployment
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
