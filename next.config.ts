import type { NextConfig } from "next";

// Next.js 16: serverComponentsExternalPackages moved to top-level serverExternalPackages
const nextConfig: NextConfig = {
  // Ensure these heavy Node packages are treated as externals for server functions
  serverExternalPackages: ["jsdom", "@mozilla/readability", "cheerio"],
};

export default nextConfig;
