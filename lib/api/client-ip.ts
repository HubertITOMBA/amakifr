import type { NextRequest } from "next/server";

/**
 * Extrait l'IP client depuis une requête.
 *
 * `x-forwarded-for` n'est fiable qu'avec un reverse proxy contrôlé
 * qui écrase / ne laisse pas le client spoofe la valeur.
 *
 * @param request - Requête Next.js
 * @returns IP ou `"unknown"`
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
