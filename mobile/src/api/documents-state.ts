/**
 * Helpers affichage / erreurs documents (purs, testables).
 */

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
 * Badge publication / validation (modèle Phase 1.5).
 */
export function documentVisibilityBadge(
  statutValidation: string,
  estPublic: boolean
): {
  label: string;
  tone: "neutral" | "primary" | "success" | "warning" | "danger";
} {
  if (statutValidation === "Valide" && estPublic) {
    return { label: "Validé · Public", tone: "success" };
  }
  if (statutValidation === "Valide") {
    return { label: "Validé", tone: "primary" };
  }
  if (statutValidation === "Rejete") {
    return { label: "Rejeté", tone: "danger" };
  }
  if (estPublic) {
    return { label: "En attente · Visible admin", tone: "warning" };
  }
  return { label: "En attente", tone: "neutral" };
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

/** Aligné serveur Phase 1. */
export const MY_DOCUMENT_MAX_BYTES = 50 * 1024 * 1024;

export const MY_DOCUMENT_ALLOWED_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
]);

/**
 * Valide un fichier côté client avant upload (serveur reste autorité).
 */
export function validateDocumentSelection(input: {
  mimeType: string;
  size: number | null | undefined;
}): { ok: true } | { ok: false; message: string } {
  const mime = String(input.mimeType || "").toLowerCase().trim();
  if (mime.startsWith("video/")) {
    return {
      ok: false,
      message: "Les vidéos ne sont pas acceptées dans cette version",
    };
  }
  if (!MY_DOCUMENT_ALLOWED_MIMES.has(mime)) {
    return {
      ok: false,
      message: "Format non autorisé (PDF ou image uniquement)",
    };
  }
  const size = Number(input.size ?? 0);
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, message: "Fichier invalide ou vide" };
  }
  if (size > MY_DOCUMENT_MAX_BYTES) {
    return { ok: false, message: "Fichier trop volumineux (max 50 Mo)" };
  }
  return { ok: true };
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
  if (error.status === 409 || error.code === "CONFLICT") {
    return error.message || "Conflit";
  }
  if (error.status >= 500) {
    return "Impossible de charger les documents";
  }
  return error.message || "Impossible de charger les documents";
}

/**
 * @deprecated Les ouvertures passent par l'endpoint authentifié /file.
 * Conservé pour tests de régression traversal uniquement.
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
