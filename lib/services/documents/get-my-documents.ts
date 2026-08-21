import { z } from "zod";
import { db } from "@/lib/db";
import type { AuthContext } from "@/lib/auth-context";
import { ServiceError } from "@/lib/service-error";
import {
  computeCanDeleteDocument,
  computeCanRequestDeleteDocument,
  documentValidationLabel,
} from "@/lib/services/documents/document-lock";
import type {
  DocumentDto,
  MyDocumentsPageDto,
} from "@/lib/services/documents/types";

const QuerySchema = z.object({
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
});

export type GetMyDocumentsOptions = {
  limit?: number;
  offset?: number;
};

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

const documentListSelect = {
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
  /** Relation filtrée une fois pour la page — pas de N+1 applicatif. */
  DeletionRequests: {
    where: { statut: "EnAttente" as const },
    select: { statut: true },
    take: 1,
    orderBy: { createdAt: "desc" as const },
  },
} as const;

/**
 * Liste paginée des documents de l'utilisateur authentifié (self-service).
 * Ownership : actor.userId uniquement. Tri : createdAt desc.
 *
 * @throws {ServiceError} UNAUTHENTICATED | VALIDATION_ERROR | INTERNAL_ERROR
 */
export async function getMyDocuments(
  actor: AuthContext,
  options: GetMyDocumentsOptions = {}
): Promise<MyDocumentsPageDto> {
  if (!actor?.userId || String(actor.userId).trim() === "") {
    throw new ServiceError("UNAUTHENTICATED", "Non autorisé");
  }

  const parsed = QuerySchema.safeParse(options);
  if (!parsed.success) {
    throw new ServiceError("VALIDATION_ERROR", "Paramètres invalides");
  }

  const { limit, offset } = parsed.data;
  const where = { userId: actor.userId };

  try {
    const [total, rows] = await Promise.all([
      db.document.count({ where }),
      db.document.findMany({
        where,
        select: documentListSelect,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
    ]);

    return {
      items: rows.map((row) => mapDocumentToDto(row, actor.userId)),
      total,
      limit,
      offset,
    };
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
