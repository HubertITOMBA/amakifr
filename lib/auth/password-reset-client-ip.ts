import type { NextRequest } from "next/server";
import { isIP } from "node:net";
import { headers } from "next/headers";

/**
 * Indique si les en-têtes proxy sont de confiance.
 * Exigé explicitement via TRUST_PROXY=true — jamais déduit de NODE_ENV seul.
 *
 * Préconditions déploiement (gardes) :
 * - Next production écoute uniquement 127.0.0.1:9060 (pas 0.0.0.0 / [::]) ;
 * - Nginx production versionné écrase X-Real-IP avec $remote_addr
 *   (deploy/nginx/amaki.conf → /etc/nginx/conf.d/amaki.conf).
 *
 * Sans TRUST_PROXY : ignorer tous les headers IP transmis.
 *
 * @see docs/auth/PASSWORD-RESET.txt
 */
export function isPasswordResetTrustProxyEnabled(): boolean {
  return process.env.TRUST_PROXY === "true";
}

/**
 * Extrait l'IP client pour password-reset.
 *
 * - TRUST_PROXY≠true → "unknown" (ignore X-Real-IP / X-Forwarded-For spoofables)
 * - TRUST_PROXY=true → uniquement X-Real-IP (écrasé par Nginx avec $remote_addr)
 * - Ne jamais prendre le premier hop X-Forwarded-For (spoofable par le client
 *   même derrière $proxy_add_x_forwarded_for)
 *
 * @param headerGet - Lecteur d'en-tête
 */
export function resolvePasswordResetClientIpFromHeaders(
  headerGet: (name: string) => string | null
): string {
  if (!isPasswordResetTrustProxyEnabled()) {
    return "unknown";
  }

  const realIp = headerGet("x-real-ip")?.trim();
  if (realIp && isPlausibleIp(realIp)) {
    return normalizeIpLiteral(realIp);
  }

  // Fallback contrôlé : dernier hop XFF seulement (ajouté par Nginx = $remote_addr)
  const forwarded = headerGet("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && isPlausibleIp(last)) {
      return normalizeIpLiteral(last);
    }
  }

  return "unknown";
}

/**
 * Normalise un littéral IP (retire les crochets IPv6 éventuels).
 */
export function normalizeIpLiteral(value: string): string {
  const v = value.trim();
  if (v.startsWith("[") && v.endsWith("]") && v.includes(":")) {
    return v.slice(1, -1);
  }
  return v;
}

/**
 * Validation stricte IPv4/IPv6 (node:net isIP) — anti-injection, pas de DNS.
 */
export function isPlausibleIp(value: string): boolean {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (v.length < 3 || v.length > 45) return false;
  if (v.includes(" ") || v.includes("\n") || v.includes("\r") || v.includes("\t")) {
    return false;
  }
  // Pas de port ni de zone-id dans X-Real-IP attendu
  if (v.includes("%")) return false;
  const literal = normalizeIpLiteral(v);
  // IPv4 avec port (1.2.3.4:8080) → refusé
  if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(literal)) return false;
  return isIP(literal) !== 0;
}

/**
 * IP depuis une NextRequest (API routes).
 */
export function getPasswordResetClientIp(request: NextRequest): string {
  return resolvePasswordResetClientIpFromHeaders((name) =>
    request.headers.get(name)
  );
}

/**
 * IP depuis les headers Next.js (Server Actions).
 */
export async function getPasswordResetClientIpFromAction(): Promise<string> {
  const h = await headers();
  return resolvePasswordResetClientIpFromHeaders((name) => h.get(name));
}
