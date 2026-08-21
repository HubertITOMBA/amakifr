import { z } from "zod";
import type { AuthContext } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import { computeCanRequestDeleteDocument } from "@/lib/services/documents/document-lock";

const MotifSchema = z.object({
  motif: z.string().max(2000).optional().nullable(),
});

/**
 * Crée une demande de suppression pour un document Valide+Public.
 * Distinct du RGPD compte.
 *
 * @throws {ServiceError} UNAUTHENTICATED | NOT_FOUND | FORBIDDEN | CONFLICT | VALIDATION_ERROR
 */
export async function requestMyDocumentDeletion(
  actor: AuthContext,
  documentId: string,
  input: { motif?: string | null } = {}
): Promise<{ id: string; statut: string }> {
  if (!actor?.userId || String(actor.userId).trim() === "") {
    throw new ServiceError("UNAUTHENTICATED", "Non autorisé");
  }

  const id = String(documentId ?? "").trim();
  if (!id || id.includes("..") || id.includes("/") || id.includes("\\")) {
    throw new ServiceError("VALIDATION_ERROR", "Identifiant invalide");
  }

  const parsed = MotifSchema.safeParse(input);
  if (!parsed.success) {
    throw new ServiceError("VALIDATION_ERROR", "Motif invalide");
  }

  const document = await db.document.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
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

  if (!computeCanRequestDeleteDocument(document, actor.userId)) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      "Ce document peut encore être supprimé directement ; aucune demande n'est nécessaire"
    );
  }

  const existing = await db.documentDeletionRequest.findFirst({
    where: { documentId: document.id, statut: "EnAttente" },
    select: { id: true, statut: true },
  });

  if (existing) {
    throw new ServiceError(
      "CONFLICT",
      "Une demande de suppression est déjà en cours pour ce document"
    );
  }

  try {
    const created = await db.documentDeletionRequest.create({
      data: {
        documentId: document.id,
        requestedBy: actor.userId,
        motif: parsed.data.motif?.trim() || null,
        statut: "EnAttente",
      },
      select: { id: true, statut: true },
    });
    return { id: created.id, statut: created.statut };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    console.error("[requestMyDocumentDeletion] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors de la création de la demande"
    );
  }
}
