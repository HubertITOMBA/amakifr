import { readFile } from "fs/promises";
import type { AuthContext } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import { resolveDocumentAbsolutePath } from "@/lib/services/documents/resolve-document-path";

export type MyDocumentFileResult = {
  bytes: Buffer;
  contentType: string;
  downloadName: string;
};

/**
 * Sert le fichier d'un document appartenant à l'acteur (anti-IDOR).
 *
 * @throws {ServiceError} UNAUTHENTICATED | NOT_FOUND | FORBIDDEN | VALIDATION_ERROR
 */
export async function getMyDocumentFile(
  actor: AuthContext,
  documentId: string
): Promise<MyDocumentFileResult> {
  if (!actor?.userId || String(actor.userId).trim() === "") {
    throw new ServiceError("UNAUTHENTICATED", "Non autorisé");
  }

  const id = String(documentId ?? "").trim();
  if (!id || id.includes("..") || id.includes("/") || id.includes("\\")) {
    throw new ServiceError("VALIDATION_ERROR", "Identifiant invalide");
  }

  const document = await db.document.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      chemin: true,
      mimeType: true,
      nomOriginal: true,
    },
  });

  if (!document) {
    throw new ServiceError("NOT_FOUND", "Document introuvable");
  }

  if (document.userId !== actor.userId) {
    throw new ServiceError("FORBIDDEN", "Accès refusé");
  }

  const absolutePath = resolveDocumentAbsolutePath(document.chemin);

  try {
    const bytes = await readFile(absolutePath);
    return {
      bytes,
      contentType: document.mimeType || "application/octet-stream",
      downloadName: document.nomOriginal || "document",
    };
  } catch {
    throw new ServiceError("NOT_FOUND", "Fichier introuvable");
  }
}
