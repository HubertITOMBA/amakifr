import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { ServiceError } from "@/lib/service-error";
import {
  PASSWORD_RESET_CODE_DIGITS,
  PASSWORD_RESET_HMAC_DOMAIN,
  PASSWORD_RESET_HMAC_SECRET_MIN_BYTES,
  PASSWORD_RESET_RL_HMAC_DOMAIN,
  type PasswordResetRateLimitOperation,
} from "@/lib/auth/password-reset-constants";

/**
 * Secret serveur dédié HMAC des codes / clés rate-limit.
 * Fail closed — aucun fallback. Non appelé au build / Prisma generate.
 *
 * @returns Secret UTF-8 ≥ 32 octets
 * @throws {ServiceError} INTERNAL_ERROR si absente/trop courte
 */
export function getPasswordResetHmacSecret(): string {
  const secret = process.env.PASSWORD_RESET_HMAC_SECRET;

  if (typeof secret !== "string" || secret.trim() === "") {
    console.error(
      "[password-reset] PASSWORD_RESET_HMAC_SECRET manquant ou vide — configuration serveur invalide"
    );
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Configuration serveur invalide"
    );
  }

  const byteLength = Buffer.byteLength(secret, "utf8");
  if (byteLength < PASSWORD_RESET_HMAC_SECRET_MIN_BYTES) {
    console.error("[password-reset] PASSWORD_RESET_HMAC_SECRET trop court", {
      byteLength,
      min: PASSWORD_RESET_HMAC_SECRET_MIN_BYTES,
    });
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Configuration serveur invalide"
    );
  }

  return secret;
}

/**
 * Valide le secret sans throw métier (gardes shell / preflight).
 *
 * @returns true si présent et ≥ 32 octets UTF-8
 */
export function isPasswordResetHmacSecretConfigured(): boolean {
  const secret = process.env.PASSWORD_RESET_HMAC_SECRET;
  if (typeof secret !== "string" || secret.trim() === "") {
    return false;
  }
  return Buffer.byteLength(secret, "utf8") >= PASSWORD_RESET_HMAC_SECRET_MIN_BYTES;
}

/**
 * Génère un code numérique à 8 chiffres via crypto.randomInt (sans biais).
 * Intervalle [0, 10^8) — uniforme. Jamais Math.random.
 *
 * @returns Code décimal paddé
 */
export function generatePasswordResetCode(): string {
  const max = 10 ** PASSWORD_RESET_CODE_DIGITS;
  return randomInt(0, max).toString().padStart(PASSWORD_RESET_CODE_DIGITS, "0");
}

/**
 * HMAC-SHA-256 hex du code avec séparation de domaine explicite.
 *
 * @param code - Code en clair (mémoire uniquement jusqu'à l'email)
 */
export function hashPasswordResetCode(code: string): string {
  const secret = getPasswordResetHmacSecret();
  return createHmac("sha256", secret)
    .update(PASSWORD_RESET_HMAC_DOMAIN + code, "utf8")
    .digest("hex");
}

/**
 * HMAC court pour clés rate-limit PG (jamais email/IP en clair).
 * Inclut l'opération (PASSWORD_RESET_REQUEST | PASSWORD_RESET_CONFIRM)
 * pour que request et confirm aient des quotas indépendants.
 *
 * @param operation - Domaine d'opération rate-limit
 * @param kind - ip | email | combo
 * @param material - Valeur déjà normalisée
 */
export function hashPasswordResetRateLimitKey(
  operation: PasswordResetRateLimitOperation,
  kind: "ip" | "email" | "combo",
  material: string
): string {
  const secret = getPasswordResetHmacSecret();
  return createHmac("sha256", secret)
    .update(
      `${PASSWORD_RESET_RL_HMAC_DOMAIN}${operation}:${kind}:${material}`,
      "utf8"
    )
    .digest("hex")
    .slice(0, 32);
}

/**
 * Compare deux digests hex en temps constant (timingSafeEqual).
 */
export function passwordResetHashesEqual(
  providedHash: string,
  storedHash: string
): boolean {
  try {
    const a = Buffer.from(providedHash, "utf8");
    const b = Buffer.from(storedHash, "utf8");
    if (a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
