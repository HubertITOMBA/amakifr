import { db } from "@/lib/db";
import { z } from "zod";
import type { AuthContext } from "@/lib/auth-context";
import { ServiceError } from "@/lib/service-error";
import type {
  CreateMyTacheCommentaireInput,
  CreateMyTacheCommentaireResult,
} from "@/lib/services/taches/types";

const CommentaireSchema = z.object({
  contenu: z.string().min(1, "Le commentaire est requis"),
  pourcentageAvancement: z.number().int().min(0).max(100).optional().nullable(),
});

/**
 * Crée un commentaire sur une tâche au nom de l'acteur authentifié.
 *
 * Anti-IDOR : l'auteur est déterminé côté serveur via actor.userId.
 * Préconditions : adhérent existe, tâche existe, adhérent affecté à la tâche.
 *
 * @throws {ServiceError} UNAUTHENTICATED | NOT_FOUND | FORBIDDEN | VALIDATION_ERROR | INTERNAL_ERROR
 */
export async function createMyTacheCommentaire(
  actor: AuthContext,
  tacheId: string,
  input: CreateMyTacheCommentaireInput
): Promise<CreateMyTacheCommentaireResult> {
  if (!actor?.userId || String(actor.userId).trim() === "") {
    throw new ServiceError("UNAUTHENTICATED", "Non autorisé");
  }

  const parsed = CommentaireSchema.safeParse(input);
  if (!parsed.success) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      parsed.error.errors[0].message
    );
  }

  if (!tacheId || String(tacheId).trim() === "") {
    throw new ServiceError("VALIDATION_ERROR", "ID tâche requis");
  }

  try {
    const adherent = await db.adherent.findUnique({
      where: { userId: actor.userId },
      select: { id: true },
    });

    if (!adherent) {
      throw new ServiceError("NOT_FOUND", "Adhérent non trouvé");
    }

    const sousProjet = await db.sousProjet.findUnique({
      where: { id: tacheId },
      include: {
        Affectations: {
          where: { adherentId: adherent.id },
        },
      },
    });

    if (!sousProjet) {
      throw new ServiceError("NOT_FOUND", "Tâche non trouvée");
    }

    if (sousProjet.Affectations.length === 0) {
      throw new ServiceError(
        "FORBIDDEN",
        "Vous n'êtes pas affecté à cette tâche"
      );
    }

    const commentaire = await db.commentaireTache.create({
      data: {
        sousProjetId: tacheId,
        adherentId: adherent.id,
        contenu: parsed.data.contenu,
        pourcentageAvancement: parsed.data.pourcentageAvancement ?? null,
      },
    });

    return { id: commentaire.id };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    console.error("[createMyTacheCommentaire] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors de la création du commentaire"
    );
  }
}
