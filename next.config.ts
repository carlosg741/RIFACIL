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
      { pathname: "/rifacil-logo.png" },
      { pathname: "/rifacil-icon.png" },
      { pathname: "/rifacil-og.png" },
      { pathname: "/apple-touch-icon.png" },
      { pathname: "/uploads/**" },
    ],
  },
};

export default nextConfig;
