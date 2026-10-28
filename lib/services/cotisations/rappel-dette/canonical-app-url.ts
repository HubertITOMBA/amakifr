import { cleanUrl } from "@/lib/utils";

/**
 * Path relatif figé du contrat lien détail v2 (catalogue).
 * Consultation self : section cotisations, vue toutes (CM + DetteInitiale sans filtre mois).
 */
export const RAPPEL_DETTE_DETAIL_PATH_V2 =
  "/user/profile?section=cotisations&vue=toutes" as const;

export type ResolveAppBaseUrlOptions = {
  /**
   * Source injectable (tests). Par défaut : `NEXT_PUBLIC_APP_URL` serveur.
   * **Jamais** un header Host / origine client.
   */
  getEnvAppUrl?: () => string | undefined | null;
};

/**
 * Indique si une URL absolue est une base applicative HTTP(S) sans credentials.
 *
 * @param absoluteUrl - URL candidate
 */
function isValidHttpOriginUrl(absoluteUrl: string): boolean {
  try {
    const u = new URL(absoluteUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (u.username !== "" || u.password !== "") return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Résout l’origine applicative depuis la configuration serveur validée.
 * Refuse schémas hors HTTP(S), credentials (`user:pass@`) et config invalide.
 * **Pas** de repli inventé (amaki.fr hardcodé, etc.).
 *
 * @param options - Source d’env injectable
 * @returns Origin `http(s)://host[:port]` sans slash final, ou null
 */
export function resolveServerAppBaseUrl(
  options?: ResolveAppBaseUrlOptions
): string | null {
  // Si un getter est fourni, il est la **seule** source (tests / injection) —
  // ne pas retomber sur process.env quand il renvoie null/undefined.
  const raw =
    options?.getEnvAppUrl !== undefined
      ? options.getEnvAppUrl()
      : process.env.NEXT_PUBLIC_APP_URL ?? null;
  const cleaned = cleanUrl(raw);
  if (!cleaned) return null;
  try {
    const u = new URL(cleaned);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.username !== "" || u.password !== "") return null;
    // Origin only — pas de path client arbitraire
    const origin = u.origin;
    if (!isValidHttpOriginUrl(origin)) return null;
    return origin;
  } catch {
    return null;
  }
}

/**
 * Construit l’URL absolue du détail cotisations v2.
 * Base = configuration serveur uniquement ; path = constante catalogue figée.
 * Aucun override client. Échec explicite (`null`) si config invalide.
 *
 * @param options - Source d’env injectable
 * @returns URL absolue HTTP(S), ou null
 */
export function buildRappelDetteDetailAbsoluteUrlV2(
  options?: ResolveAppBaseUrlOptions
): string | null {
  const base = resolveServerAppBaseUrl(options);
  if (!base) return null;
  const absolute = `${base}${RAPPEL_DETTE_DETAIL_PATH_V2}`;
  try {
    const u = new URL(absolute);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.username !== "" || u.password !== "") return null;
    // Path + query doivent rester ceux du catalogue (pas de mutation)
    if (
      `${u.pathname}${u.search}` !==
      RAPPEL_DETTE_DETAIL_PATH_V2
    ) {
      return null;
    }
    return absolute;
  } catch {
    return null;
  }
}
