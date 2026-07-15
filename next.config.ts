import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    localPatterns: [
      { pathname: "/rifacil-logo.jpeg" },
      { pathname: "/uploads/**" },
    ],
  },
};

export default nextConfig;
