import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Allow these Node packages to be externalized for server components/functions
    serverComponentsExternalPackages: ["jsdom", "@mozilla/readability", "cheerio"],
  },
};

export default nextConfig;
