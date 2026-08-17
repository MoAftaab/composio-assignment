import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@atlas/shared", "@atlas/research"],
  experimental: { externalDir: true }
};

export default nextConfig;
