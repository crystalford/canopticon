import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@canopticon/shared"],
  experimental: {
    typedRoutes: true,
  },
};

export default config;
