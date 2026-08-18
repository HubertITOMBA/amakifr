import { db } from "@/lib/db";
import type { AuthContext } from "@/lib/auth-context";
import { ServiceError } from "@/lib/service-error";
import type { DocumentDto } from "@/lib/services/documents/types";

/**
 * Liste les documents de l'utilisateur authentifié (self-service).
 *
 * Anti-IDOR : filtre exclusivement sur actor.userId — jamais d'userId / adherentId client.
 * Un compte sans Adherent peut légitimement avoir une liste vide (ownership = User).
 *
 * @param actor - Identité authentifiée
 * @returns Liste de DocumentDto (éventuellement vide)
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
        nomOriginal: true,
        type: true,
        categorie: true,
        chemin: true,
        taille: true,
        mimeType: true,
        description: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return rows.map((row) => ({
      id: row.id,
      nomOriginal: row.nomOriginal,
      type: row.type,
      categorie: row.categorie,
      chemin: row.chemin,
      taille: row.taille,
      mimeType: row.mimeType,
      description: row.description,
      createdAt: row.createdAt.toISOString(),
    }));
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
