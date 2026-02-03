import type { MetadataRoute } from "next";

const baseUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://amaki.fr");

/** Pages publiques à inclure dans le sitemap (référencement Google, Bing, etc.) */
const publicPaths: { path: string; priority?: number; changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never" }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/amicale", priority: 0.9, changeFrequency: "monthly" },
  { path: "/agenda", priority: 0.9, changeFrequency: "weekly" },
  { path: "/evenements", priority: 0.9, changeFrequency: "weekly" },
  { path: "/galerie", priority: 0.8, changeFrequency: "weekly" },
  { path: "/contact", priority: 0.8, changeFrequency: "yearly" },
  { path: "/confidentialite", priority: 0.5, changeFrequency: "yearly" },
  { path: "/inscription", priority: 0.8, changeFrequency: "monthly" },
  { path: "/candidatures", priority: 0.7, changeFrequency: "monthly" },
  { path: "/candidats", priority: 0.7, changeFrequency: "monthly" },
  { path: "/rapports-reunion", priority: 0.6, changeFrequency: "monthly" },
  { path: "/resultats", priority: 0.6, changeFrequency: "monthly" },
  { path: "/idees", priority: 0.6, changeFrequency: "monthly" },
  { path: "/suppression-donnees", priority: 0.4, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = baseUrl.replace(/\/$/, "");
  return publicPaths.map(({ path, priority = 0.7, changeFrequency }) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));
}
