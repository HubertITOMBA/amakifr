import { z } from "zod";
import type { AuthContext } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";

const MessageSchema = z.object({
  message: z.string().max(2000).optional().nullable(),
});

export type SubmitMyDataDeletionResult = {
  id: string;
  statut: string;
};

/**
 * Demande RGPD de suppression de compte pour l'utilisateur connecté.
 * Réutilise le modèle DataDeletionRequest (pas de nouvelle table).
 * Ownership : actor.userId / email session — jamais d'email client arbitraire.
 *
 * @throws {ServiceError} UNAUTHENTICATED | CONFLICT | INTERNAL_ERROR
 */
export async function submitMyDataDeletionRequest(
  actor: AuthContext,
  input: { message?: string | null } = {}
): Promise<SubmitMyDataDeletionResult> {
  if (!actor?.userId || String(actor.userId).trim() === "") {
    throw new ServiceError("UNAUTHENTICATED", "Non autorisé");
  }

  const parsed = MessageSchema.safeParse(input);
  if (!parsed.success) {
    throw new ServiceError("VALIDATION_ERROR", "Message invalide");
  }

  const user = await db.user.findUnique({
    where: { id: actor.userId },
    select: {
      id: true,
      email: true,
      name: true,
      adherent: {
        select: { firstname: true, lastname: true },
      },
    },
  });

  if (!user?.email) {
    throw new ServiceError("NOT_FOUND", "Compte introuvable");
  }

  const existing = await db.dataDeletionRequest.findFirst({
    where: {
      userId: user.id,
      statut: { in: ["EnAttente", "EnVerification", "Approuvee"] },
    },
    select: { id: true },
  });

  if (existing) {
    throw new ServiceError(
      "CONFLICT",
      "Une demande de suppression est déjà en cours pour ce compte"
    );
  }

  const userName =
    user.name ||
    (user.adherent
      ? `${user.adherent.firstname} ${user.adherent.lastname}`
      : null);

  try {
    const created = await db.dataDeletionRequest.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        userName,
        message: parsed.data.message?.trim() || null,
        statut: "EnAttente",
      },
      select: { id: true, statut: true },
    });

    return { id: created.id, statut: created.statut };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    console.error("[submitMyDataDeletionRequest] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors de la création de la demande"
    );
  }
}

/**
 * Statut de la demande RGPD active (si existante) pour l'acteur.
 */
export async function getMyDataDeletionRequest(
  actor: AuthContext
): Promise<{ id: string; statut: string; createdAt: string } | null> {
  if (!actor?.userId || String(actor.userId).trim() === "") {
    throw new ServiceError("UNAUTHENTICATED", "Non autorisé");
  }

  const row = await db.dataDeletionRequest.findFirst({
    where: {
      userId: actor.userId,
      statut: {
        in: ["EnAttente", "EnVerification", "Approuvee", "Rejetee"],
      },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, statut: true, createdAt: true },
  });

  if (!row) return null;
  return {
    id: row.id,
    statut: row.statut,
    createdAt: row.createdAt.toISOString(),
  };
}
