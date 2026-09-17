/**
 * Liste financière minimale pour COMCPT / ADMIN / TRESOR (lot 4.4).
 * Pas de justificatifs ni description libre. Pagination serveur.
 */
import { db } from "@/lib/db";
import {
  NotesFraisDisabledError,
  assertNotesFraisEnabled,
} from "@/lib/frais-avances/feature-flag";
import { canUserReadNoteFraisFinancialView } from "@/lib/frais-avances/authz";
import {
  NOTES_FRAIS_FINANCIAL_STATE_INCONSISTENT,
  computeEtatFinancierNoteFrais,
} from "@/lib/services/frais-avances/note-frais-remboursement-service";
import { normalizeNotesFraisMontant } from "@/lib/services/frais-avances/note-frais-decision-service";
import {
  buildNotesFraisListPaginationMeta,
  normalizeNotesFraisListPagination,
  queryComptabiliteNoteFraisListIds,
  type NotesFraisListPagination,
} from "@/lib/frais-avances/list-pagination";

export type NoteFraisComptabiliteListItemDto = {
  noteId: string;
  libelle: string;
  statut: string;
  version: number;
  montantAccepte: string;
  montantDemande: string;
  modeChoix: string | null;
  etatFinancier: "NON_REGLEE" | "PARTIELLEMENT_REGLEE" | "REGLEE" | null;
  alerteEtatFinancier: boolean;
  restantDu: string | null;
  consomme: string | null;
  montantRembourseUtilise: string;
  montantCompensationUtilise: string;
  adherentLabel: string | null;
  decideeAt: string | null;
};

export type NotesFraisComptabiliteListResult =
  | {
      success: true;
      data: {
        items: NoteFraisComptabiliteListItemDto[];
        pagination: NotesFraisListPagination;
      };
    }
  | { success: false; error: string; code?: string };

/**
 * Liste paginée des notes VALIDEE avec agrégats financiers.
 */
export async function listNotesFraisComptabilite(input: {
  userId: string;
  etatFinancier?:
    | "NON_REGLEE"
    | "PARTIELLEMENT_REGLEE"
    | "REGLEE"
    | "all";
  page?: number;
  pageSize?: number;
  client?: typeof db;
}): Promise<NotesFraisComptabiliteListResult> {
  const client = input.client ?? db;
  try {
    assertNotesFraisEnabled();
    const allowed = await canUserReadNoteFraisFinancialView(
      input.userId,
      client
    );
    if (!allowed) {
      return { success: false, error: "Non autorisé", code: "FORBIDDEN" };
    }

    const { page, pageSize } = normalizeNotesFraisListPagination(input);
    const { ids, total } = await queryComptabiliteNoteFraisListIds({
      etatFinancier: input.etatFinancier,
      page,
      pageSize,
      client,
    });

    if (ids.length === 0) {
      return {
        success: true,
        data: {
          items: [],
          pagination: buildNotesFraisListPaginationMeta({
            page,
            pageSize,
            total,
          }),
        },
      };
    }

    const rows = await client.noteFrais.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        libelle: true,
        statut: true,
        version: true,
        montantDemande: true,
        montantAccepte: true,
        decideeAt: true,
        Adherent: { select: { firstname: true, lastname: true } },
        ChoixReglements: {
          where: { statut: "ACTIF" },
          take: 1,
          select: {
            mode: true,
            montantRembourseUtilise: true,
            montantCompensationUtilise: true,
          },
        },
      },
    });

    const byId = new Map(rows.map((r) => [r.id, r]));
    const items: NoteFraisComptabiliteListItemDto[] = [];
    for (const id of ids) {
      const row = byId.get(id);
      if (!row) continue;
      const choix = row.ChoixReglements[0];
      const montantAccepte = normalizeNotesFraisMontant(row.montantAccepte);
      if (!choix || !montantAccepte) continue;

      let etatFinancier: NoteFraisComptabiliteListItemDto["etatFinancier"] =
        null;
      let restantDu: string | null = null;
      let consomme: string | null = null;
      let alerteEtatFinancier = false;
      try {
        const etat = computeEtatFinancierNoteFrais({
          montantAccepte,
          montantRembourseUtilise: choix.montantRembourseUtilise,
          montantCompensationUtilise: choix.montantCompensationUtilise,
        });
        etatFinancier = etat.etatFinancier;
        restantDu = etat.restantDu;
        consomme = etat.consomme;
      } catch (e) {
        if (
          e instanceof Error &&
          e.message === NOTES_FRAIS_FINANCIAL_STATE_INCONSISTENT
        ) {
          alerteEtatFinancier = true;
        } else {
          throw e;
        }
      }

      items.push({
        noteId: row.id,
        libelle: row.libelle,
        statut: row.statut,
        version: row.version,
        montantAccepte,
        montantDemande:
          normalizeNotesFraisMontant(row.montantDemande) ?? "0.00",
        modeChoix: choix.mode,
        etatFinancier,
        alerteEtatFinancier,
        restantDu,
        consomme,
        montantRembourseUtilise:
          normalizeNotesFraisMontant(choix.montantRembourseUtilise) ?? "0.00",
        montantCompensationUtilise:
          normalizeNotesFraisMontant(choix.montantCompensationUtilise) ??
          "0.00",
        adherentLabel: row.Adherent
          ? `${row.Adherent.firstname} ${row.Adherent.lastname}`
          : null,
        decideeAt: row.decideeAt?.toISOString() ?? null,
      });
    }

    return {
      success: true,
      data: {
        items,
        pagination: buildNotesFraisListPaginationMeta({
          page,
          pageSize,
          total,
        }),
      },
    };
  } catch (error) {
    if (error instanceof NotesFraisDisabledError) {
      return {
        success: false,
        error: error.message,
        code: "NOTES_FRAIS_DISABLED",
      };
    }
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Erreur inattendue" };
  }
}
