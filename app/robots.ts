import type { MetadataRoute } from "next";

const baseUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://amaki.fr");

export default function robots(): MetadataRoute.Robots {
  const origin = baseUrl.replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/api/",
          "/user/",
          "/auth/",
          "/paiement/cancel",
          "/paiement/success",
          "/vote/",
          "/vote-simple/",
          "/chat/",
          "/extrat/",
        ],
      },
      { userAgent: "Googlebot", allow: "/", disallow: ["/admin/", "/api/", "/user/", "/auth/", "/paiement/", "/vote/", "/vote-simple/", "/chat/", "/extrat/"] },
      { userAgent: "Bingbot", allow: "/", disallow: ["/admin/", "/api/", "/user/", "/auth/", "/paiement/", "/vote/", "/vote-simple/", "/chat/", "/extrat/"] },
      { userAgent: "Applebot", allow: "/", disallow: ["/admin/", "/api/", "/user/", "/auth/", "/paiement/", "/vote/", "/vote-simple/", "/chat/", "/extrat/"] },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
