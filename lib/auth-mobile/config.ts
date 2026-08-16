import { ServiceError } from "@/lib/service-error";

/**
 * Longueur minimale du secret HS256 (octets UTF-8).
 * 32 octets = 256 bits — cohérent avec HS256.
 */
export const MOBILE_ACCESS_TOKEN_SECRET_MIN_BYTES = 32;

/**
 * Retourne le secret de signature des access tokens mobile.
 * Fail closed : aucun fallback "dev-secret" / "change-me" / "secret".
 *
 * Exige une longueur UTF-8 ≥ {@link MOBILE_ACCESS_TOKEN_SECRET_MIN_BYTES}.
 *
 * @returns Secret suffisamment long
 * @throws {ServiceError} INTERNAL_ERROR si absente, vide ou trop courte
 */
export function getMobileAccessTokenSecret(): string {
  const secret = process.env.MOBILE_ACCESS_TOKEN_SECRET;

  if (typeof secret !== "string" || secret.trim() === "") {
    console.error(
      "[auth-mobile] MOBILE_ACCESS_TOKEN_SECRET manquant ou vide — configuration serveur invalide"
    );
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Configuration serveur invalide"
    );
  }

  const byteLength = Buffer.byteLength(secret, "utf8");
  if (byteLength < MOBILE_ACCESS_TOKEN_SECRET_MIN_BYTES) {
    console.error(
      "[auth-mobile] MOBILE_ACCESS_TOKEN_SECRET trop court",
      { byteLength, min: MOBILE_ACCESS_TOKEN_SECRET_MIN_BYTES }
    );
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Configuration serveur invalide"
    );
  }

  return secret;
}
