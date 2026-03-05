import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === 'true';
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] || '';

const nextConfig: NextConfig = {
  output: 'export',

  // Set base path when deploying to GitHub Pages (served from /repo-name/)
  ...(isGitHubPages && repoName ? { basePath: `/${repoName}` } : {}),

  // Disable image optimization for external GitHub avatars
  images: {
    unoptimized: true,
  },

  // Ensure trailing slashes for compatibility
  trailingSlash: true,
};

export default nextConfig;
