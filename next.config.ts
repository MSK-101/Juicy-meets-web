import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Heroku deployment optimizations
  output: 'standalone',
  experimental: {
    // Disable features that might cause issues on Heroku
    serverComponentsExternalPackages: [],
  },
  // Ensure proper static file handling
  trailingSlash: false,
  // Optimize for production builds
  swcMinify: true,
};

export default nextConfig;
