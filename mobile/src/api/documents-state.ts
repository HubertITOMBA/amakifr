import type { TypeDocument } from "@/api/types";

/**
 * Libellé français du type de document.
 */
export function documentTypeLabel(type: TypeDocument | string): string {
  switch (type) {
    case "PDF":
      return "PDF";
    case "Image":
      return "Image";
    case "Video":
      return "Vidéo";
    case "Excel":
      return "Excel";
    case "Word":
      return "Word";
    default:
      return "Autre";
  }
}

/**
 * Formate une taille en octets (entier) pour l'UI.
 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${Math.round(bytes)} o`;
  const kilo = bytes / 1024;
  if (kilo < 1024) {
    const rounded = kilo < 10 ? kilo.toFixed(1) : String(Math.round(kilo));
    return `${rounded} Ko`;
  }
  const mega = kilo / 1024;
  const rounded = mega < 10 ? mega.toFixed(1) : String(Math.round(mega));
  return `${rounded} Mo`;
}

/**
 * Construit une URL d'ouverture sûre vers `/ressources/documents/*`.
 * Refuse les autres dossiers /ressources, le traversal et l'encodage `%2e%2e`.
 */
export function buildDocumentOpenUrl(
  baseUrl: string,
  chemin: string | null | undefined
): string | null {
  const base = (baseUrl ?? "").trim().replace(/\/$/, "");
  const path = (chemin ?? "").trim();
  if (!base || !path) return null;
  if (!path.startsWith("/ressources/documents/")) return null;
  if (path.includes("\\") || path.includes("//")) return null;

  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return null;
  }

  if (
    path.includes("..") ||
    decoded.includes("..") ||
    path.toLowerCase().includes("%2e%2e")
  ) {
    return null;
  }

  if (!decoded.startsWith("/ressources/documents/")) return null;

  return `${base}${path}`;
}

/**
 * Message utilisateur depuis ApiClientError (documents).
 */
export function documentErrorMessage(error: {
  status: number;
  code: string;
  message: string;
}): string {
  if (error.status === 0 || error.code === "NETWORK_ERROR") {
    return "Serveur injoignable";
  }
  if (error.status === 429 || error.code === "RATE_LIMITED") {
    return "Trop de requêtes. Réessayez plus tard.";
  }
  if (error.status === 403 || error.code === "FORBIDDEN") {
    return error.message || "Accès refusé.";
  }
  if (error.status >= 500) {
    return "Impossible de charger les documents";
  }
  return error.message || "Impossible de charger les documents";
}
