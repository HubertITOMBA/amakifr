import { createHash, randomBytes } from "crypto";
import {
  MOBILE_REFRESH_TOKEN_BYTES,
} from "@/lib/auth-mobile/constants";

/**
 * Génère un refresh token opaque (non JWT), haute entropie.
 *
 * @returns Token brut encodé en base64url (à envoyer au client une seule fois)
 */
export function generateRefreshToken(): string {
  return randomBytes(MOBILE_REFRESH_TOKEN_BYTES).toString("base64url");
}

/**
 * Hash SHA-256 d'un refresh token opaque (déjà haute entropie).
 * Ne jamais stocker le token brut en base.
 *
 * @param token - Refresh token brut
 * @returns Digest hexadécimal
 */
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
