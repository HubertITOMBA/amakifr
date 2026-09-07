import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { AuthContext } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import { buildAssistanceDisplayLabel } from "@/lib/services/cotisations/build-assistance-display-label";
import { decimalToMoneyString } from "@/lib/services/cotisations/decimal-to-money-string";
import type {
  MyCotisationLineDto,
  MyCotisationLinesPageDto,
  MyCotisationYearSummaryDto,
} from "@/lib/services/cotisations/types";

const QuerySchema = z.object({
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
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
    throw new ServiceError("NOT_FOUND", "Adhérent introuvable");
  }
  return adherent.id;
}

async function buildSummary(adherentId: string): Promise<MyCotisationYearSummaryDto> {
  const [
    dettesRows,
    openCotisations,
    openAssistances,
    openObligations,
    avoirsDisponibles,
    payeAgg,
  ] = await Promise.all([
    db.detteInitiale.findMany({
      where: { adherentId },
      select: { montantRestant: true },
    }),
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
    db.paiementCotisation.aggregate({
      where: {
        adherentId,
        statut: "Valide",
        inscriptionEvenementId: null,
      },
      _sum: { montant: true },
    }),
  ]);

  let totalDette = new Prisma.Decimal(0);
  for (const d of dettesRows) totalDette = totalDette.plus(d.montantRestant);
  for (const c of openCotisations) totalDette = totalDette.plus(c.montantRestant);
  for (const a of openAssistances) totalDette = totalDette.plus(a.montantRestant);
  for (const o of openObligations) totalDette = totalDette.plus(o.montantRestant);

  let totalAvoirs = new Prisma.Decimal(0);
  for (const a of avoirsDisponibles) {
    totalAvoirs = totalAvoirs.plus(a.montantRestant);
  }

  const detteNette = totalDette.minus(totalAvoirs).gt(0)
    ? totalDette.minus(totalAvoirs)
    : new Prisma.Decimal(0);

  return {
    detteBrute: decimalToMoneyString(totalDette),
    avoirDisponible: decimalToMoneyString(totalAvoirs),
    resteNet: decimalToMoneyString(detteNette),
    totalPayeAnnee: decimalToMoneyString(
      new Prisma.Decimal(payeAgg._sum.montant ?? 0)
    ),
  };
}

export type GetMyCotisationLinesOptions = {
  limit?: number;
  offset?: number;
};

/**
 * Liste chronologique paginée de toutes les lignes (dettes + cotisations + assistances).
 * Vue « Toutes les années » — ownership via actor.userId.
 *
 * @param actor - Contexte auth
 * @param options - limit / offset
 */
export async function getMyCotisationLines(
  actor: AuthContext,
  options: GetMyCotisationLinesOptions = {}
): Promise<MyCotisationLinesPageDto> {
  const parsed = QuerySchema.safeParse(options);
  if (!parsed.success) {
    throw new ServiceError("VALIDATION_ERROR", "Paramètres invalides");
  }

  const { limit, offset } = parsed.data;

  try {
    const adherentId = await resolveSelfAdherentId(actor);

    const [dettesRows, cotisationsRows, pendingPayments, summary] =
      await Promise.all([
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
        db.cotisationMensuelle.findMany({
          where: { adherentId },
          select: {
            id: true,
            annee: true,
            mois: true,
            adherentBeneficiaireId: true,
            montantAttendu: true,
            montantPaye: true,
            montantRestant: true,
            statut: true,
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
          orderBy: [{ annee: "desc" }, { mois: "desc" }, { periode: "desc" }],
        }),
        db.paiementCotisation.findMany({
          where: {
            adherentId,
            statut: "EnAttente",
            inscriptionEvenementId: null,
          },
          select: {
            cotisationMensuelleId: true,
            detteInitialeId: true,
          },
        }),
        buildSummary(adherentId),
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

    const lines: MyCotisationLineDto[] = [];

    for (const d of dettesRows) {
      const restant = new Prisma.Decimal(d.montantRestant);
      const paye = new Prisma.Decimal(d.montantPaye);
      let statut = "EnAttente";
      if (restant.lte(0)) statut = "Paye";
      else if (paye.gt(0)) statut = "PartiellementPaye";

      lines.push({
        kind: "dette",
        id: d.id,
        annee: d.annee,
        mois: null,
        label: `Dette antérieure ${d.annee}`,
        montantAttendu: decimalToMoneyString(d.montant),
        montantPaye: decimalToMoneyString(d.montantPaye),
        montantRestant: decimalToMoneyString(d.montantRestant),
        statut,
        hasPendingPayment: pendingDetteIds.has(d.id),
        paymentTargetType: "dette-initiale",
        paymentTargetId: d.id,
      });
    }

    for (const row of cotisationsRows) {
      const isAssistance =
        row.TypeCotisation.categorie === "Assistance" ||
        row.TypeCotisation.aBeneficiaire === true;
      if (
        isAssistance &&
        row.adherentBeneficiaireId &&
        row.adherentBeneficiaireId === adherentId
      ) {
        continue;
      }

      const moisLabel = MOIS_LABELS[row.mois - 1] ?? String(row.mois);
      if (isAssistance) {
        const benef =
          row.AdherentBeneficiaire ??
          row.CotisationDuMois?.AdherentBeneficiaire ??
          null;
        lines.push({
          kind: "assistance",
          id: row.id,
          annee: row.annee,
          mois: row.mois,
          label: buildAssistanceDisplayLabel({
            typeNom: row.TypeCotisation.nom,
            description: row.description,
            beneficiaire: benef,
          }),
          montantAttendu: decimalToMoneyString(row.montantAttendu),
          montantPaye: decimalToMoneyString(row.montantPaye),
          montantRestant: decimalToMoneyString(row.montantRestant),
          statut: row.statut,
          hasPendingPayment: pendingCotisationIds.has(row.id),
          paymentTargetType: "cotisation-mensuelle",
          paymentTargetId: row.id,
        });
      } else {
        lines.push({
          kind: "cotisation",
          id: row.id,
          annee: row.annee,
          mois: row.mois,
          label: `Cotisation forfaitaire - ${moisLabel} ${row.annee}`,
          montantAttendu: decimalToMoneyString(row.montantAttendu),
          montantPaye: decimalToMoneyString(row.montantPaye),
          montantRestant: decimalToMoneyString(row.montantRestant),
          statut: row.statut,
          hasPendingPayment: pendingCotisationIds.has(row.id),
          paymentTargetType: "cotisation-mensuelle",
          paymentTargetId: row.id,
        });
      }
    }

    // Plus récent d'abord : année DESC, mois DESC (null mois = début d'année pour dettes)
    lines.sort((a, b) => {
      if (a.annee !== b.annee) return b.annee - a.annee;
      const ma = a.mois ?? 0;
      const mb = b.mois ?? 0;
      if (ma !== mb) return mb - ma;
      return a.label.localeCompare(b.label, "fr");
    });

    const total = lines.length;
    const items = lines.slice(offset, offset + limit);

    return { items, total, limit, offset, summary };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    console.error("[getMyCotisationLines] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors de la récupération des lignes de cotisation"
    );
  }
}
