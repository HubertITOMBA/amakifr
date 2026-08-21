import { z } from "zod";
import type { AuthContext } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import { mapPayment } from "@/lib/services/cotisations/get-my-cotisation-year";
import type { MyPaymentsPageDto } from "@/lib/services/cotisations/types";

const QuerySchema = z.object({
  annee: z.number().int().min(2000).max(2100).optional(),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
});

/**
 * Résout l'adhérent self-service depuis actor.userId (anti-IDOR).
 */
async function resolveSelfAdherentId(actor: AuthContext): Promise<string> {
  if (!actor?.userId || String(actor.userId).trim() === "") {
    throw new ServiceError("UNAUTHENTICATED", "Non autorisé");
  }

  const adherent = await db.adherent.findUnique({
    where: { userId: actor.userId },
    select: { id: true },
  });
  if (!adherent) {
    throw new ServiceError("NOT_FOUND", "Adhérent introuvable");
  }
  return adherent.id;
}

const paymentSelect = {
  id: true,
  datePaiement: true,
  montant: true,
  moyenPaiement: true,
  statut: true,
  reference: true,
  description: true,
  cotisationMensuelleId: true,
  detteInitialeId: true,
  assistanceId: true,
  CotisationMensuelle: {
    select: {
      mois: true,
      annee: true,
      description: true,
      TypeCotisation: {
        select: {
          nom: true,
          categorie: true,
          aBeneficiaire: true,
        },
      },
      AdherentBeneficiaire: {
        select: {
          civility: true,
          firstname: true,
          lastname: true,
        },
      },
      CotisationDuMois: {
        select: {
          AdherentBeneficiaire: {
            select: {
              civility: true,
              firstname: true,
              lastname: true,
            },
          },
        },
      },
    },
  },
  DetteInitiale: { select: { annee: true } },
  Assistance: { select: { type: true, description: true } },
} as const;

export type GetMyPaymentsOptions = {
  annee?: number;
  limit?: number;
  offset?: number;
};

/**
 * Historique paginé des paiements de l'adhérent connecté.
 * Ownership via actor.userId uniquement.
 *
 * @param actor - Contexte auth
 * @param options - annee (optionnelle), limit, offset
 */
export async function getMyPayments(
  actor: AuthContext,
  options: GetMyPaymentsOptions = {}
): Promise<MyPaymentsPageDto> {
  const parsed = QuerySchema.safeParse(options);
  if (!parsed.success) {
    throw new ServiceError("VALIDATION_ERROR", "Paramètres invalides");
  }

  const { annee, limit, offset } = parsed.data;

  try {
    const adherentId = await resolveSelfAdherentId(actor);

    const where =
      annee !== undefined
        ? {
            adherentId,
            datePaiement: {
              gte: new Date(Date.UTC(annee, 0, 1, 0, 0, 0, 0)),
              lt: new Date(Date.UTC(annee + 1, 0, 1, 0, 0, 0, 0)),
            },
          }
        : { adherentId };

    const [total, rows] = await Promise.all([
      db.paiementCotisation.count({ where }),
      db.paiementCotisation.findMany({
        where,
        select: paymentSelect,
        orderBy: { datePaiement: "desc" },
        take: limit,
        skip: offset,
      }),
    ]);

    return {
      items: rows.map(mapPayment),
      total,
      limit,
      offset,
    };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    console.error("[getMyPayments] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors de la récupération de l'historique des paiements"
    );
  }
}
