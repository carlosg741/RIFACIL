import type { MetadataRoute } from "next";

function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://rifacil-rifas.vercel.app"
  );
}

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/login", "/api/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: new URL(base).host,
  };
}
