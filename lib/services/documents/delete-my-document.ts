import { unlink } from "fs/promises";
import type { AuthContext } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import { computeCanDeleteDocument } from "@/lib/services/documents/document-lock";
import { resolveDocumentAbsolutePath } from "@/lib/services/documents/resolve-document-path";

/**
 * Supprime un document de l'utilisateur connecté.
 * Refus si Valide + Public (DOCUMENT_DELETE_REQUIRES_ADMIN via FORBIDDEN message).
 *
 * @throws {ServiceError} UNAUTHENTICATED | NOT_FOUND | FORBIDDEN | VALIDATION_ERROR
 */
export async function deleteMyDocument(
  actor: AuthContext,
  documentId: string
): Promise<{ id: string }> {
  if (!actor?.userId || String(actor.userId).trim() === "") {
    throw new ServiceError("UNAUTHENTICATED", "Non autorisé");
  }

  const id = String(documentId ?? "").trim();
  if (!id || id.includes("..") || id.includes("/") || id.includes("\\")) {
    throw new ServiceError("VALIDATION_ERROR", "Identifiant invalide");
  }

  try {
    const document = await db.document.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        chemin: true,
        estPublic: true,
        statutValidation: true,
      },
    });

    if (!document) {
      throw new ServiceError("NOT_FOUND", "Document introuvable");
    }

    if (document.userId !== actor.userId) {
      throw new ServiceError("FORBIDDEN", "Accès refusé");
    }

    if (!computeCanDeleteDocument(document, actor.userId)) {
      throw new ServiceError(
        "FORBIDDEN",
        "DOCUMENT_DELETE_REQUIRES_ADMIN: ce document validé et public ne peut être supprimé que par l'administration"
      );
    }

    try {
      const abs = resolveDocumentAbsolutePath(document.chemin);
      await unlink(abs);
    } catch (fileError) {
      console.warn("[deleteMyDocument] Fichier absent ou illisible:", fileError);
    }

    await db.document.delete({ where: { id: document.id } });
    return { id: document.id };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    console.error("[deleteMyDocument] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors de la suppression du document"
    );
  }
}
