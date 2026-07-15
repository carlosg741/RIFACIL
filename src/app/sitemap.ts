import type { MetadataRoute } from "next";
import { inArray } from "drizzle-orm";
import { ensureSchema, getDb } from "@/db";
import { raffles } from "@/db/schema";

function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://rifacil-rifas.vercel.app"
  );
}

/** Cachea 1 hora: más rápido y estable para Googlebot */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const entries: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];

  try {
    await ensureSchema();
    const db = await getDb();
    const rows = await db
      .select({
        slug: raffles.slug,
        updatedAt: raffles.updatedAt,
        status: raffles.status,
      })
      .from(raffles)
      .where(inArray(raffles.status, ["active", "closed", "drawn"]));

    for (const row of rows) {
      entries.push({
        url: `${base}/r/${row.slug}`,
        lastModified: row.updatedAt ?? new Date(),
        changeFrequency: "daily",
        priority: row.status === "active" ? 0.9 : 0.6,
      });
      if (row.status === "drawn") {
        entries.push({
          url: `${base}/r/${row.slug}/sorteo`,
          lastModified: row.updatedAt ?? new Date(),
          changeFrequency: "monthly",
          priority: 0.5,
        });
      }
    }
  } catch {
    /* Si la DB falla, al menos devolvemos la home */
  }

  return entries;
}
