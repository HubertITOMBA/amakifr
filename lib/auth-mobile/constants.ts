/**
 * Constantes TTL auth mobile (Phase 2K).
 * Les durées ne sont PAS codées dans Prisma — uniquement côté service.
 */

/** Durée de vie de l'access token JWT (secondes) — 15 minutes */
export const MOBILE_ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/** Durée de vie du refresh token opaque (millisecondes) — 30 jours */
export const MOBILE_REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Claim `type` attendu dans l'access JWT */
export const MOBILE_ACCESS_TOKEN_TYPE = "access" as const;

/** Octets aléatoires pour le refresh opaque (haute entropie) */
export const MOBILE_REFRESH_TOKEN_BYTES = 48;
