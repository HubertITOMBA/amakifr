/**
 * Configuration API mobile.
 * EXPO_PUBLIC_* est embarqué dans le bundle — valeurs publiques uniquement.
 *
 * Sur téléphone physique, `localhost` pointe vers le téléphone, PAS la machine Fedora.
 * Utiliser l'IP LAN du serveur (ex. http://192.168.1.50:9052).
 * Production : HTTPS uniquement.
 */

/**
 * Base API (sans slash final).
 */
export function getApiBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!url) {
    throw new Error(
      "EXPO_PUBLIC_API_URL manquant. Copiez mobile/.env.example vers mobile/.env"
    );
  }
  return url.replace(/\/$/, "");
}

/**
 * Construit l'URL absolue d'un endpoint /api/v1/...
 */
export function buildApiUrl(path: string): string {
  const base = getApiBaseUrl();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
