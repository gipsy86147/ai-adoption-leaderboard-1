import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',

  // Disable image optimization for external GitHub avatars
  images: {
    unoptimized: true,
  },

  // Ensure trailing slashes for compatibility
  trailingSlash: true,
};

export default nextConfig;
