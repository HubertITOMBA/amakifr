/**
 * Lecture financière dédiée (lot 4.2 / 4.6) — ADMIN|TRESOR|COMCPT.
 * Pas de justificatifs, description libre, ni chemins de stockage.
 * COMCPT : montants nets uniquement, sans référence / motif / preuve / acteur.
 * ADMIN|TRESOR : nets + référence de remboursement (pas motif/preuve correction ici).
 */
import { AdminRole, UserRole, UserStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
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
import { computeReglementNetMontant } from "@/lib/services/frais-avances/note-frais-correction-service";

export type NotesFraisFinancialViewActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export type NoteFraisFinancialRemboursementDto = {
  id: string;
  /** Montant net (brut + corrections négatives). */
  montantTotal: string;
  moyen: string;
  /** Présent uniquement pour ADMIN|TRESOR — clé absente pour COMCPT. */
  reference?: string;
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
    /** Présent uniquement pour ADMIN|TRESOR. */
    reference?: string;
  };
};

export type NoteFraisFinancialCorrectionDto = {
  id: string;
  reglementId: string;
  type: "REFERENCE" | "MONTANT_NEGATIF";
  createdAt: string;
  /** Absolu du montant corrigé si MONTANT_NEGATIF. */
  montantCorrection?: string;
};

/**
 * Agrégats + règlements (montants nets).
 * Opérations MIXTE groupées sans double comptage.
 * Aucun justificatif / description / chemin / motif / preuve / acteur.
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
  /** Journal des corrections (type + montant absolu + date) — sans motif/preuve/réf/acteur. */
  corrections: NoteFraisFinancialCorrectionDto[];
};

function money(v: Prisma.Decimal | number | string): Prisma.Decimal {
  return new Prisma.Decimal(v);
}

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

const REF_ROLES = new Set<string>([
  UserRole.ADMIN,
  UserRole.TRESOR,
  AdminRole.ADMIN,
  AdminRole.TRESOR,
]);

/**
 * True si le lecteur peut voir les références (ADMIN|TRESOR), pas COMCPT.
 */
async function canIncludeFinancialReference(
  userId: string,
  client: typeof db
): Promise<boolean> {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true },
  });
  if (!user || user.status !== UserStatus.Actif) return false;
  if (REF_ROLES.has(user.role)) return true;
  const extras = await client.userAdminRole.findMany({
    where: {
      userId,
      role: { in: [AdminRole.ADMIN, AdminRole.TRESOR] },
    },
    select: { role: true },
  });
  return extras.length > 0;
}

/**
 * Vue financière comptable d'une note (montants nets ; références selon rôle).
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

    const includeReference = await canIncludeFinancialReference(
      input.userId,
      client
    );

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
        Corrections: {
          where: { type: "MONTANT_NEGATIF" },
          select: { montant: true },
        },
      },
    });

    const compensations = await client.noteFraisReglement.findMany({
      where: {
        noteFraisId: input.noteId,
        type: "COMPENSATION",
        statut: "EXECUTE",
      },
      orderBy: { executeAt: "asc" },
      select: {
        id: true,
        montantTotal: true,
        operationId: true,
        Corrections: {
          where: { type: "MONTANT_NEGATIF" },
          select: { montant: true },
        },
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
            Corrections: {
              where: { type: "MONTANT_NEGATIF" },
              select: { montant: true },
            },
          },
        },
      },
    });

    const allCorrections = await client.noteFraisReglementCorrection.findMany({
      where: { Reglement: { noteFraisId: input.noteId } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        reglementId: true,
        type: true,
        montant: true,
        createdAt: true,
      },
    });

    const netById = new Map<string, string>();
    for (const r of remboursements) {
      netById.set(
        r.id,
        computeReglementNetMontant(
          r.montantTotal,
          r.Corrections.map((c) => c.montant)
        ).toFixed(2)
      );
    }
    for (const c of compensations) {
      netById.set(
        c.id,
        computeReglementNetMontant(
          c.montantTotal,
          c.Corrections.map((x) => x.montant)
        ).toFixed(2)
      );
    }

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
        remboursements: remboursements.map((r) => {
          const base: NoteFraisFinancialRemboursementDto = {
            id: r.id,
            montantTotal: netById.get(r.id) ?? "0.00",
            moyen: r.moyen ?? "",
            executeAt: r.executeAt.toISOString(),
            operationId: r.operationId,
          };
          if (includeReference && r.reference) {
            base.reference = r.reference;
          }
          return base;
        }),
        operationsMixte: operations.map((op) => {
          const remb = op.Reglements.find((r) => r.type === "REMBOURSEMENT");
          const comp = op.Reglements.find((r) => r.type === "COMPENSATION");
          const rembNet = remb
            ? computeReglementNetMontant(
                remb.montantTotal,
                remb.Corrections.map((c) => c.montant)
              ).toFixed(2)
            : "0.00";
          const compNet = comp
            ? computeReglementNetMontant(
                comp.montantTotal,
                comp.Corrections.map((c) => c.montant)
              ).toFixed(2)
            : "0.00";
          const rembDto: NoteFraisFinancialOperationDto["remboursement"] = {
            reglementId: remb?.id ?? "",
            montantTotal: rembNet,
            moyen: remb?.moyen ?? "",
          };
          if (includeReference && remb?.reference) {
            rembDto.reference = remb.reference;
          }
          return {
            id: op.id,
            executeAt: op.executeAt.toISOString(),
            compensation: {
              reglementId: comp?.id ?? "",
              montantTotal: compNet,
            },
            remboursement: rembDto,
          };
        }),
        corrections: allCorrections.map((c) => {
          const entry: NoteFraisFinancialCorrectionDto = {
            id: c.id,
            reglementId: c.reglementId,
            type: c.type as "REFERENCE" | "MONTANT_NEGATIF",
            createdAt: c.createdAt.toISOString(),
          };
          if (c.type === "MONTANT_NEGATIF" && c.montant != null) {
            const s = money(c.montant).abs().toFixed(2);
            entry.montantCorrection = s;
          }
          return entry;
        }),
      },
    };
  } catch (error) {
    return mapError(error);
  }
}
