import path from "path";
import { ServiceError } from "@/lib/service-error";

/**
 * Résout un chemin Document (DB) vers un fichier local sûr.
 * Supporte legacy public `/ressources/documents/...` et privé `private/documents/...`.
 * Interdit path traversal.
 */
export function resolveDocumentAbsolutePath(chemin: string): string {
  const raw = String(chemin ?? "").trim();
  if (!raw) {
    throw new ServiceError("NOT_FOUND", "Document introuvable");
  }

  if (raw.includes("..") || raw.includes("\\")) {
    throw new ServiceError("VALIDATION_ERROR", "Chemin invalide");
  }

  // Nouveau stockage privé
  if (raw.startsWith("private/documents/")) {
    const rest = raw.slice("private/documents/".length);
    const filename = path.basename(rest);
    if (!filename || rest !== filename || filename.includes("..")) {
      throw new ServiceError("VALIDATION_ERROR", "Chemin invalide");
    }
    return path.join(process.cwd(), "storage", "documents", filename);
  }

  // Legacy public
  const normalized = raw.startsWith("/") ? raw.slice(1) : raw;
  if (!normalized.startsWith("ressources/documents/")) {
    throw new ServiceError("NOT_FOUND", "Document introuvable");
  }

  const parts = normalized.split("/");
  // ressources / documents / [categorie?] / file
  if (parts.length < 3 || parts[0] !== "ressources" || parts[1] !== "documents") {
    throw new ServiceError("VALIDATION_ERROR", "Chemin invalide");
  }

  const filename = parts[parts.length - 1];
  if (!filename || filename.includes("..")) {
    throw new ServiceError("VALIDATION_ERROR", "Chemin invalide");
  }

  // Catégorie optionnelle (un seul segment)
  if (parts.length === 3) {
    return path.join(
      process.cwd(),
      "public",
      "ressources",
      "documents",
      filename
    );
  }
  if (parts.length === 4) {
    const categorie = parts[2];
    if (
      !categorie ||
      categorie.includes("..") ||
      categorie.includes("/") ||
      categorie.includes("\\")
    ) {
      throw new ServiceError("VALIDATION_ERROR", "Chemin invalide");
    }
    return path.join(
      process.cwd(),
      "public",
      "ressources",
      "documents",
      categorie,
      filename
    );
  }

  throw new ServiceError("VALIDATION_ERROR", "Chemin invalide");
}
