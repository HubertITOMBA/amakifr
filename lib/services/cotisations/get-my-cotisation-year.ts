import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { z } from "zod";
import type { AuthContext } from "@/lib/auth-context";
import { ServiceError } from "@/lib/service-error";
import { decimalToMoneyString } from "@/lib/services/cotisations/decimal-to-money-string";
import { buildAssistanceDisplayLabel } from "@/lib/services/cotisations/build-assistance-display-label";
import type {
  CotisationMensuelleDto,
  MyAssistanceDto,
  MyCotisationYearDto,
  MyCotisationYearItemDto,
  MyDebtDto,
  MyPaymentDto,
} from "@/lib/services/cotisations/types";

import {
  buildPaymentDestinationLabel,
  isTechnicalPaymentNote,
} from "@/lib/services/cotisations/payment-destination-label";

export { buildPaymentDestinationLabel, isTechnicalPaymentNote };

const YearSchema = z.object({
  annee: z.number().int().min(2000).max(2100),
});

const MOIS_LABELS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
] as const;

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
    throw new ServiceError("NOT_FOUND", "Adhérent non trouvé");
  }

  return adherent.id;
}

function mapTypeCotisation(
  type: CotisationMensuelleDto["typeCotisation"] extends infer T ? T : never
): CotisationMensuelleDto["typeCotisation"] {
  return type;
}

function mapCotisationRow(row: {
  id: string;
  periode: string;
  annee: number;
  mois: number;
  typeCotisationId: string;
  adherentId: string;
  adherentBeneficiaireId: string | null;
  montantAttendu: Prisma.Decimal;
  montantPaye: Prisma.Decimal;
  montantRestant: Prisma.Decimal;
  dateEcheance: Date;
  statut: string;
  description: string | null;
  cotisationDuMoisId: string | null;
  createdAt: Date;
  updatedAt: Date;
  TypeCotisation: {
    id: string;
    nom: string;
    description: string | null;
    montant: Prisma.Decimal;
    obligatoire: boolean;
    actif: boolean;
    ordre: number;
    categorie: CotisationMensuelleDto["typeCotisation"]["categorie"];
    aBeneficiaire: boolean;
  };
}): CotisationMensuelleDto {
  return {
    id: row.id,
    periode: row.periode,
    annee: row.annee,
    mois: row.mois,
    typeCotisationId: row.typeCotisationId,
    adherentId: row.adherentId,
    adherentBeneficiaireId: row.adherentBeneficiaireId,
    montantAttendu: decimalToMoneyString(row.montantAttendu),
    montantPaye: decimalToMoneyString(row.montantPaye),
    montantRestant: decimalToMoneyString(row.montantRestant),
    dateEcheance: row.dateEcheance.toISOString(),
    statut: row.statut,
    description: row.description,
    cotisationDuMoisId: row.cotisationDuMoisId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    typeCotisation: mapTypeCotisation({
      id: row.TypeCotisation.id,
      nom: row.TypeCotisation.nom,
      description: row.TypeCotisation.description,
      montant: decimalToMoneyString(row.TypeCotisation.montant),
      obligatoire: row.TypeCotisation.obligatoire,
      actif: row.TypeCotisation.actif,
      ordre: row.TypeCotisation.ordre,
      categorie: row.TypeCotisation.categorie,
      aBeneficiaire: row.TypeCotisation.aBeneficiaire,
    }),
  };
}

const cotisationMensuelleForPaymentSelect = {
  mois: true,
  annee: true,
  description: true,
  TypeCotisation: {
    select: { nom: true, categorie: true, aBeneficiaire: true },
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
} as const;

export function mapPayment(row: {
  id: string;
  datePaiement: Date;
  montant: Prisma.Decimal;
  moyenPaiement: string;
  statut: string;
  reference: string | null;
  description: string | null;
  cotisationMensuelleId: string | null;
  detteInitialeId: string | null;
  assistanceId: string | null;
  CotisationMensuelle: {
    mois: number;
    annee: number;
    description?: string | null;
    TypeCotisation: {
      nom: string;
      categorie?: string | null;
      aBeneficiaire?: boolean | null;
    };
    AdherentBeneficiaire?: {
      civility?: string | null;
      firstname?: string | null;
      lastname?: string | null;
    } | null;
    CotisationDuMois?: {
      AdherentBeneficiaire?: {
        civility?: string | null;
        firstname?: string | null;
        lastname?: string | null;
      } | null;
    } | null;
  } | null;
  DetteInitiale: { annee: number } | null;
  Assistance: { type: string; description?: string | null } | null;
}): MyPaymentDto {
  return {
    id: row.id,
    datePaiement: row.datePaiement.toISOString(),
    montant: decimalToMoneyString(row.montant),
    moyenPaiement: row.moyenPaiement,
    statut: row.statut,
    reference: row.reference,
    destinationLabel: buildPaymentDestinationLabel(row),
    cotisationMensuelleId: row.cotisationMensuelleId,
    detteInitialeId: row.detteInitialeId,
    assistanceId: row.assistanceId,
  };
}

/**
 * Vue financière annuelle self-service (Phase A — lecture seule).
 *
 * Synthèse dette/avoir/resteNet : même composition que getCumulDette Web,
 * sans accepter d'adherentId client.
 *
 * Assistances affichées = lignes CotisationMensuelle (catégorie Assistance),
 * comme la liste mensuelle profil Web — pas l'entité Assistance (bénéficiaire).
 *
 * @throws {ServiceError} UNAUTHENTICATED | NOT_FOUND | VALIDATION_ERROR | INTERNAL_ERROR
 */
export async function getMyCotisationYear(
  actor: AuthContext,
  annee: number
): Promise<MyCotisationYearDto> {
  const parsed = YearSchema.safeParse({ annee });
  if (!parsed.success) {
    throw new ServiceError("VALIDATION_ERROR", "Année invalide");
  }

  const year = parsed.data.annee;

  try {
    const adherentId = await resolveSelfAdherentId(actor);

    const yearStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));

    const [
      cotisationsRows,
      dettesRows,
      pendingPayments,
      payeAnneeAgg,
      openCotisations,
      openAssistances,
      openObligations,
      avoirsDisponibles,
    ] = await Promise.all([
      db.cotisationMensuelle.findMany({
        where: { adherentId, annee: year },
        select: {
          id: true,
          periode: true,
          annee: true,
          mois: true,
          typeCotisationId: true,
          adherentId: true,
          adherentBeneficiaireId: true,
          montantAttendu: true,
          montantPaye: true,
          montantRestant: true,
          dateEcheance: true,
          statut: true,
          description: true,
          cotisationDuMoisId: true,
          createdAt: true,
          updatedAt: true,
          TypeCotisation: {
            select: {
              id: true,
              nom: true,
              description: true,
              montant: true,
              obligatoire: true,
              actif: true,
              ordre: true,
              categorie: true,
              aBeneficiaire: true,
            },
          },
          AdherentBeneficiaire: {
            select: {
              id: true,
              civility: true,
              firstname: true,
              lastname: true,
            },
          },
          CotisationDuMois: {
            select: {
              adherentBeneficiaireId: true,
              AdherentBeneficiaire: {
                select: {
                  id: true,
                  civility: true,
                  firstname: true,
                  lastname: true,
                },
              },
            },
          },
        },
        orderBy: [{ mois: "asc" }, { periode: "asc" }],
      }),
      db.detteInitiale.findMany({
        where: { adherentId },
        select: {
          id: true,
          annee: true,
          montant: true,
          montantPaye: true,
          montantRestant: true,
          description: true,
        },
        orderBy: { annee: "desc" },
      }),
      // Une seule requête pour tous les EnAttente (pas de N+1 par carte)
      // Exclure paiements événement (isolation cotisations)
      db.paiementCotisation.findMany({
        where: {
          adherentId,
          statut: "EnAttente",
          inscriptionEvenementId: null,
        },
        select: {
          cotisationMensuelleId: true,
          detteInitialeId: true,
          assistanceId: true,
        },
      }),
      db.paiementCotisation.aggregate({
        where: {
          adherentId,
          statut: "Valide",
          inscriptionEvenementId: null,
          datePaiement: { gte: yearStart, lt: yearEnd },
        },
        _sum: { montant: true },
      }),
      // --- synthèse (miroir getCumulDette, scoped self) ---
      db.cotisationMensuelle.findMany({
        where: {
          adherentId,
          statut: { in: ["EnAttente", "PartiellementPaye", "EnRetard"] },
        },
        select: { montantRestant: true },
      }),
      db.assistance.findMany({
        where: { adherentId, statut: { in: ["EnAttente"] } },
        select: { montantRestant: true },
      }),
      db.obligationCotisation.findMany({
        where: {
          adherentId,
          statut: { in: ["EnAttente", "PartiellementPaye", "EnRetard"] },
        },
        select: { montantRestant: true },
      }),
      db.avoir.findMany({
        where: {
          adherentId,
          statut: "Disponible",
          montantRestant: { gt: 0 },
        },
        select: { montantRestant: true },
      }),
    ]);

    const pendingCotisationIds = new Set(
      pendingPayments
        .map((p) => p.cotisationMensuelleId)
        .filter((id): id is string => Boolean(id))
    );
    const pendingDetteIds = new Set(
      pendingPayments
        .map((p) => p.detteInitialeId)
        .filter((id): id is string => Boolean(id))
    );

    let totalDette = new Prisma.Decimal(0);
    for (const d of dettesRows) {
      totalDette = totalDette.plus(d.montantRestant);
    }
    for (const c of openCotisations) {
      totalDette = totalDette.plus(c.montantRestant);
    }
    for (const a of openAssistances) {
      totalDette = totalDette.plus(a.montantRestant);
    }
    for (const o of openObligations) {
      totalDette = totalDette.plus(o.montantRestant);
    }

    let totalAvoirs = new Prisma.Decimal(0);
    for (const a of avoirsDisponibles) {
      totalAvoirs = totalAvoirs.plus(a.montantRestant);
    }

    const detteNette = totalDette.minus(totalAvoirs).gt(0)
      ? totalDette.minus(totalAvoirs)
      : new Prisma.Decimal(0);

    const totalPayeAnnee = new Prisma.Decimal(payeAnneeAgg._sum.montant ?? 0);

    const cotisations: MyCotisationYearItemDto[] = [];
    const assistances: MyAssistanceDto[] = [];

    for (const row of cotisationsRows) {
      // Filtre Web : le bénéficiaire ne paie pas sa propre assistance
      const isAssistanceCategory =
        row.TypeCotisation.categorie === "Assistance" ||
        row.TypeCotisation.aBeneficiaire === true;
      if (
        isAssistanceCategory &&
        row.adherentBeneficiaireId &&
        row.adherentBeneficiaireId === adherentId
      ) {
        continue;
      }

      const base = mapCotisationRow(row);
      const hasPendingPayment = pendingCotisationIds.has(row.id);

      if (isAssistanceCategory) {
        const benef =
          row.AdherentBeneficiaire ??
          row.CotisationDuMois?.AdherentBeneficiaire ??
          null;
        const typeNom = row.TypeCotisation.nom;
        assistances.push({
          id: row.id,
          source: "cotisation",
          paymentTargetType: "cotisation-mensuelle",
          displayLabel: buildAssistanceDisplayLabel({
            typeNom,
            description: row.description,
            beneficiaire: benef,
          }),
          libelle: typeNom,
          description: row.description?.trim() || null,
          annee: row.annee,
          mois: row.mois,
          periode: row.periode,
          dateEvenement: null,
          typeEvenement: null,
          montantAttendu: base.montantAttendu,
          montantPaye: base.montantPaye,
          montantRestant: base.montantRestant,
          statut: row.statut,
          hasPendingPayment,
        });
      } else {
        cotisations.push({ ...base, hasPendingPayment });
      }
    }

    const dettes: MyDebtDto[] = dettesRows.map((d) => ({
      id: d.id,
      annee: d.annee,
      montant: decimalToMoneyString(d.montant),
      montantPaye: decimalToMoneyString(d.montantPaye),
      montantRestant: decimalToMoneyString(d.montantRestant),
      description: d.description,
      hasPendingPayment: pendingDetteIds.has(d.id),
    }));

    return {
      annee: year,
      summary: {
        detteBrute: decimalToMoneyString(totalDette),
        avoirDisponible: decimalToMoneyString(totalAvoirs),
        resteNet: decimalToMoneyString(detteNette),
        totalPayeAnnee: decimalToMoneyString(totalPayeAnnee),
      },
      cotisations,
      assistances,
      dettes,
    };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    console.error("[getMyCotisationYear] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors de la récupération des cotisations"
    );
  }
}
