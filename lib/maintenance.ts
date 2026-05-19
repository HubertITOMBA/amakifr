import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Indique si le mode maintenance est activé (variable d'environnement).
 *
 * @env MAINTENANCE_MODE - true | 1 pour activer
 */
export function isMaintenanceEnabled(): boolean {
  const v = process.env.MAINTENANCE_MODE;
  return v === "1" || v === "true" || v === "TRUE";
}

/**
 * Récupère l'IP client (proxy nginx / développement local).
 */
export function getClientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return request.headers.get("x-real-ip");
}

/**
 * IPs autorisées à contourner la maintenance.
 *
 * @env MAINTENANCE_BYPASS_IPS - liste séparée par des virgules
 * Ne pas inclure 127.0.0.1 si vous voulez voir la page en local.
 */
export function isBypassedIp(request: NextRequest): boolean {
  const raw = process.env.MAINTENANCE_BYPASS_IPS;
  if (!raw?.trim()) return false;
  const ip = getClientIp(request);
  if (!ip) return false;
  const allowed = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return allowed.includes(ip);
}

/**
 * Chemins accessibles même en mode maintenance (assets, webhooks, page maintenance).
 */
export function isExemptMaintenancePath(pathname: string): boolean {
  if (pathname === "/maintenance" || pathname === "/maintenance.html") return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico" || pathname === "/favicon.svg") return true;
  if (pathname.startsWith("/api/webhooks")) return true;
  if (pathname.startsWith("/api/auth")) return true;
  return /\.(ico|png|jpg|jpeg|gif|webp|svg|woff2?|ttf|eot|css|js)$/i.test(pathname);
}

/**
 * Réponse rewrite vers la page de maintenance (HTTP 503).
 */
export function maintenanceRewrite(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/maintenance";
  url.search = "";
  return NextResponse.rewrite(url, {
    status: 503,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Retry-After": "120",
    },
  });
}
