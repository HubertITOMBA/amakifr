/**
 * Lecture financière dédiée (lot 4.2) — ADMIN|TRESOR|COMCPT.
 * Pas de justificatifs, description libre, ni chemins de stockage.
 * Ne remplace pas getNoteFraisForUser (détail live / PRESID|SECRET exclus de cette vue).
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

export type NotesFraisFinancialViewActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export type NoteFraisFinancialRemboursementDto = {
  id: string;
  montantTotal: string;
  moyen: string;
  /** Référence complète — réservée à cette vue comptable. */
  reference: string;
  executeAt: string;
  operationId: string | null;
};

export type NoteFraisFinancialOperationDto = {
  id: string;
  executeAt: string;
  compensation: { reglementId: string; montantTotal: string };
  remboursement: {
    reglementId: string;
    montantTotal: string;
    moyen: string;
    reference: string;
  };
};

/**
 * Agrégats + règlements remboursements (référence incluse).
 * Opérations MIXTE groupées (enfants) sans double comptage des totaux état.
 * Aucun justificatif / description / chemin.
 */
export type NoteFraisFinancialViewDto = {
  noteId: string;
  statut: string;
  version: number;
  montantAccepte: string | null;
  modeChoix: string | null;
  montantRemboursement: string | null;
  montantCompensation: string | null;
  montantRembourseUtilise: string | null;
  montantCompensationUtilise: string | null;
  etatFinancier: "NON_REGLEE" | "PARTIELLEMENT_REGLEE" | "REGLEE";
  restantDu: string;
  consomme: string;
  remboursements: NoteFraisFinancialRemboursementDto[];
  operationsMixte: NoteFraisFinancialOperationDto[];
};

function disabledResult(): NotesFraisFinancialViewActionResult<never> {
  return {
    success: false,
    error: "Le module frais avancés n'est pas activé.",
    code: "NOTES_FRAIS_DISABLED",
  };
}

function mapError(error: unknown): NotesFraisFinancialViewActionResult<never> {
  if (error instanceof NotesFraisDisabledError) return disabledResult();
  if (error instanceof Error) {
    let code: string | undefined;
    if (error.message === NOTES_FRAIS_FINANCIAL_STATE_INCONSISTENT) {
      code = NOTES_FRAIS_FINANCIAL_STATE_INCONSISTENT;
    }
    if (error.message.includes("Non autorisé")) code = "FORBIDDEN";
    if (error.message.includes("introuvable")) code = "NOT_FOUND";
    return { success: false, error: error.message, code };
  }
  return { success: false, error: "Erreur inattendue" };
}

/**
 * Vue financière comptable d'une note (références de remboursement incluses).
 *
 * @param input.userId - Lecteur Actif ADMIN|TRESOR|COMCPT (pas le propriétaire membre)
 * @param input.noteId - Note cible
 */
export async function getNoteFraisFinancialView(input: {
  userId: string;
  noteId: string;
  client?: typeof db;
}): Promise<NotesFraisFinancialViewActionResult<NoteFraisFinancialViewDto>> {
  const client = input.client ?? db;
  try {
    assertNotesFraisEnabled();

    const allowed = await canUserReadNoteFraisFinancialView(
      input.userId,
      client
    );
    if (!allowed) {
      throw new Error("Non autorisé à consulter la vue financière");
    }

    const note = await client.noteFrais.findUnique({
      where: { id: input.noteId },
      select: {
        id: true,
        statut: true,
        version: true,
        demandeurUserId: true,
        montantAccepte: true,
        ChoixReglements: {
          where: { statut: "ACTIF" },
          take: 1,
          select: {
            mode: true,
            montantRemboursement: true,
            montantCompensation: true,
            montantRembourseUtilise: true,
            montantCompensationUtilise: true,
          },
        },
      },
    });
    if (!note || note.statut === "BROUILLON") {
      throw new Error("Note introuvable");
    }

    // Propriétaire membre : DTO sans référence via getNoteFraisForUser uniquement.
    if (note.demandeurUserId === input.userId) {
      throw new Error(
        "Non autorisé : le propriétaire utilise le DTO membre sans référence"
      );
    }

    const choix = note.ChoixReglements[0] ?? null;
    const montantAccepte = normalizeNotesFraisMontant(note.montantAccepte);
    if (montantAccepte == null || !choix) {
      throw new Error("État financier indisponible pour cette note");
    }

    const etat = computeEtatFinancierNoteFrais({
      montantAccepte,
      montantRembourseUtilise: choix.montantRembourseUtilise,
      montantCompensationUtilise: choix.montantCompensationUtilise,
    });

    const remboursements = await client.noteFraisReglement.findMany({
      where: {
        noteFraisId: input.noteId,
        type: "REMBOURSEMENT",
        statut: "EXECUTE",
      },
      orderBy: { executeAt: "asc" },
      select: {
        id: true,
        montantTotal: true,
        moyen: true,
        reference: true,
        executeAt: true,
        operationId: true,
      },
    });

    const operations = await client.noteFraisReglementOperation.findMany({
      where: { noteFraisId: input.noteId, type: "MIXTE" },
      orderBy: { executeAt: "asc" },
      include: {
        Reglements: {
          select: {
            id: true,
            type: true,
            montantTotal: true,
            moyen: true,
            reference: true,
          },
        },
      },
    });

    return {
      success: true,
      data: {
        noteId: note.id,
        statut: note.statut,
        version: note.version,
        montantAccepte,
        modeChoix: choix.mode,
        montantRemboursement:
          normalizeNotesFraisMontant(choix.montantRemboursement),
        montantCompensation:
          normalizeNotesFraisMontant(choix.montantCompensation),
        montantRembourseUtilise: normalizeNotesFraisMontant(
          choix.montantRembourseUtilise
        ),
        montantCompensationUtilise: normalizeNotesFraisMontant(
          choix.montantCompensationUtilise
        ),
        etatFinancier: etat.etatFinancier,
        restantDu: etat.restantDu,
        consomme: etat.consomme,
        remboursements: remboursements.map((r) => ({
          id: r.id,
          montantTotal: normalizeNotesFraisMontant(r.montantTotal) ?? "0.00",
          moyen: r.moyen ?? "",
          reference: r.reference ?? "",
          executeAt: r.executeAt.toISOString(),
          operationId: r.operationId,
        })),
        operationsMixte: operations.map((op) => {
          const remb = op.Reglements.find((r) => r.type === "REMBOURSEMENT");
          const comp = op.Reglements.find((r) => r.type === "COMPENSATION");
          return {
            id: op.id,
            executeAt: op.executeAt.toISOString(),
            compensation: {
              reglementId: comp?.id ?? "",
              montantTotal:
                normalizeNotesFraisMontant(comp?.montantTotal) ?? "0.00",
            },
            remboursement: {
              reglementId: remb?.id ?? "",
              montantTotal:
                normalizeNotesFraisMontant(remb?.montantTotal) ?? "0.00",
              moyen: remb?.moyen ?? "",
              reference: remb?.reference ?? "",
            },
          };
        }),
      },
    };
  } catch (error) {
    return mapError(error);
  }
}
