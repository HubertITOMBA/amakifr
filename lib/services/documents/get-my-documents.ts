import { db } from "@/lib/db";
import type { AuthContext } from "@/lib/auth-context";
import { ServiceError } from "@/lib/service-error";
import {
  computeCanDeleteDocument,
  computeCanRequestDeleteDocument,
  documentValidationLabel,
} from "@/lib/services/documents/document-lock";
import type { DocumentDto } from "@/lib/services/documents/types";

/**
 * Mappe une ligne Document vers le DTO self-service (sans chemin).
 */
export function mapDocumentToDto(
  row: {
    id: string;
    userId: string;
    nomOriginal: string;
    type: DocumentDto["type"];
    categorie: string | null;
    taille: number;
    mimeType: string;
    description: string | null;
    createdAt: Date;
    estPublic: boolean;
    statutValidation: DocumentDto["statutValidation"];
    DeletionRequests?: Array<{ statut: string }>;
  },
  actorUserId: string
): DocumentDto {
  const pendingRequest = (row.DeletionRequests ?? []).find(
    (r) => r.statut === "EnAttente"
  );
  const canDelete = computeCanDeleteDocument(row, actorUserId);
  const canRequestDelete =
    computeCanRequestDeleteDocument(row, actorUserId) && !pendingRequest;

  return {
    id: row.id,
    nomOriginal: row.nomOriginal,
    type: row.type,
    categorie: row.categorie,
    taille: row.taille,
    mimeType: row.mimeType,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    estPublic: row.estPublic,
    statutValidation: row.statutValidation,
    statusLabel: documentValidationLabel(row.statutValidation, row.estPublic),
    canDelete,
    canRequestDelete,
    deletionRequestStatus: pendingRequest
      ? "EnAttente"
      : (row.DeletionRequests?.[0]?.statut as DocumentDto["deletionRequestStatus"]) ??
        null,
  };
}

/**
 * Liste les documents de l'utilisateur authentifié (self-service).
 *
 * @throws {ServiceError} UNAUTHENTICATED | INTERNAL_ERROR
 */
export async function getMyDocuments(
  actor: AuthContext
): Promise<DocumentDto[]> {
  if (!actor?.userId || String(actor.userId).trim() === "") {
    throw new ServiceError("UNAUTHENTICATED", "Non autorisé");
  }

  try {
    const rows = await db.document.findMany({
      where: { userId: actor.userId },
      select: {
        id: true,
        userId: true,
        nomOriginal: true,
        type: true,
        categorie: true,
        taille: true,
        mimeType: true,
        description: true,
        createdAt: true,
        estPublic: true,
        statutValidation: true,
        DeletionRequests: {
          where: { statut: "EnAttente" },
          select: { statut: true },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return rows.map((row) => mapDocumentToDto(row, actor.userId));
  } catch (error) {
    if (error instanceof ServiceError) {
      throw error;
    }
    console.error("[getMyDocuments] Erreur lecture Document:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors de la récupération des documents"
    );
  }
}
