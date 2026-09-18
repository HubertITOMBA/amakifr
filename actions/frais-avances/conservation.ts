"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  isNotesFraisEnabled,
  NOTES_FRAIS_DISABLED_MESSAGE,
} from "@/lib/frais-avances/feature-flag";
import {
  canUserManageNotesFraisLegalHold,
  canUserReadNotesFraisRetentionPolicy,
  canUserWriteNotesFraisRetentionPolicy,
} from "@/lib/frais-avances/authz";
import {
  activateRetentionPolicyVersion,
  countRetentionDueWithoutPii,
  createRetentionPolicyDraft,
  CreateRetentionPolicyDraftSchema,
  getActiveRetentionPolicy,
  listRetentionPolicyVersions,
} from "@/lib/services/frais-avances/note-frais-retention-policy-service";
import {
  leverLegalHold,
  listLegalHolds,
  poseLegalHoldOnArchive,
  poseLegalHoldOnPeriode,
} from "@/lib/services/frais-avances/note-frais-legal-hold-service";
import { db } from "@/lib/db";
import { logUserActivity } from "@/lib/activity-logger";
import { TypeActivite } from "@prisma/client";

function disabled() {
  return {
    success: false as const,
    error: NOTES_FRAIS_DISABLED_MESSAGE,
    code: "NOTES_FRAIS_DISABLED" as const,
  };
}

async function requireSessionUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Non authentifié");
  }
  return session.user.id;
}

/**
 * Charge l'état conservation (sans PII dans les compteurs).
 */
export async function actionGetNotesFraisConservationState() {
  if (!isNotesFraisEnabled()) return disabled();
  try {
    const userId = await requireSessionUserId();
    if (!(await canUserReadNotesFraisRetentionPolicy(userId))) {
      return { success: false as const, error: "Accès refusé" };
    }
    const canWrite = await canUserWriteNotesFraisRetentionPolicy(userId);
    const canManageHold = await canUserManageNotesFraisLegalHold(userId);
    const active = await getActiveRetentionPolicy();
    const versions = await listRetentionPolicyVersions();
    const due = await countRetentionDueWithoutPii();
    const holds = await listLegalHolds({ statut: "ALL", limit: 50 });
    // Archives récentes (id + montants déjà visibles archive) pour ciblage hold ADMIN.
    const archivesForHold = canManageHold
      ? await db.noteFraisArchive.findMany({
          take: 30,
          orderBy: { archivedAt: "desc" },
          select: {
            id: true,
            dateDepense: true,
            montantDemande: true,
            retentionEndsAt: true,
            archivedAt: true,
          },
        })
      : [];
    return {
      success: true as const,
      data: {
        canWrite,
        canManageHold,
        active,
        versions,
        due: {
          archivesDueP2: due.archivesDueP2,
          piecesDueP1: due.piecesDueP1,
          journalDueP3: due.journalDueP3,
          nextEndsAt: due.nextEndsAt?.toISOString() ?? null,
        },
        holds: canManageHold
          ? holds.map((h) => ({
              id: h.id,
              cibleType: h.cibleType,
              archiveId: h.archiveId,
              periodeCle: h.periodeCle,
              statut: h.statut,
              motif: h.motif,
              referenceDossier: h.referenceDossier,
              posedAt: h.posedAt.toISOString(),
              leveAt: h.leveAt?.toISOString() ?? null,
              expiresAt: h.expiresAt?.toISOString() ?? null,
            }))
          : holds
              .filter((h) => h.statut === "ACTIF")
              .map((h) => ({
                id: h.id,
                cibleType: h.cibleType,
                archiveId: h.archiveId,
                periodeCle: h.periodeCle,
                statut: h.statut,
                // Lecture seule TRESOR/COMCPT : pas de motif/référence
                motif: null as string | null,
                referenceDossier: null as string | null,
                posedAt: h.posedAt.toISOString(),
                leveAt: h.leveAt?.toISOString() ?? null,
                expiresAt: h.expiresAt?.toISOString() ?? null,
              })),
        archivesForHold: archivesForHold.map((a) => ({
          id: a.id,
          dateDepense: a.dateDepense.toISOString(),
          montantDemande: String(a.montantDemande),
          retentionEndsAt: a.retentionEndsAt.toISOString(),
          archivedAt: a.archivedAt.toISOString(),
        })),
        legalWarning:
          "Les durées de conservation (10 ans après clôture d'exercice) relèvent d'une décision métier. Toute modification est prospective uniquement : les archives et journaux existants conservent leur snapshot immuable. V1 : reportsSansEcheance=true obligatoire ; effectiveAt ≤ maintenant à l'activation. Validation expert-comptable / DPO recommandée avant production.",
      },
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erreur",
    };
  }
}

const ActivateSchema = z.object({
  policyId: z.string().min(1),
  expectedOccVersion: z.number().int().min(1),
  activationIdempotencyKey: z.string().min(8).max(64),
  confirmProspectiveOnly: z.literal(true),
});

/**
 * Crée un brouillon puis l'active (nouvelle version — jamais UPDATE destructif).
 */
export async function actionCreateAndActivateRetentionPolicy(form: {
  p1Years: number;
  p2Years: number;
  p3Years: number;
  exerciceClotureMois: number;
  exerciceClotureJour: number;
  /** Ignoré en V1 — forcé à true. */
  reportsSansEcheance?: boolean;
  motif: string;
  effectiveAt: string;
  activationIdempotencyKey: string;
  confirmProspectiveOnly: boolean;
}) {
  if (!isNotesFraisEnabled()) return disabled();
  try {
    const userId = await requireSessionUserId();
    if (!(await canUserWriteNotesFraisRetentionPolicy(userId))) {
      return { success: false as const, error: "Accès refusé — ADMIN requis" };
    }
    if (form.confirmProspectiveOnly !== true) {
      return {
        success: false as const,
        error: "Confirmation explicite requise (impact prospectif uniquement)",
      };
    }

    const draftInput = CreateRetentionPolicyDraftSchema.parse({
      p1Years: form.p1Years,
      p2Years: form.p2Years,
      p3Years: form.p3Years,
      exerciceClotureMois: form.exerciceClotureMois,
      exerciceClotureJour: form.exerciceClotureJour,
      // V1 : toujours true — false refusé fail-closed
      reportsSansEcheance: true as const,
      motif: form.motif,
      effectiveAt: form.effectiveAt,
    });

    const draft = await createRetentionPolicyDraft(draftInput, userId);
    const act = ActivateSchema.parse({
      policyId: draft.id,
      expectedOccVersion: 1,
      activationIdempotencyKey: form.activationIdempotencyKey,
      confirmProspectiveOnly: true,
    });

    const result = await activateRetentionPolicyVersion({
      policyId: act.policyId,
      activatedByUserId: userId,
      activationIdempotencyKey: act.activationIdempotencyKey,
      expectedOccVersion: act.expectedOccVersion,
    });

    await logUserActivity(
      TypeActivite.Modification,
      "Activation politique conservation notes de frais",
      "NoteFraisRetentionPolicyVersion",
      result.activatedId,
      {
        version: draft.version,
        replacedId: result.replacedId,
        alreadyApplied: result.alreadyApplied,
        p1Years: draftInput.p1Years,
        p2Years: draftInput.p2Years,
        p3Years: draftInput.p3Years,
        prospectiveOnly: true,
      }
    );

    revalidatePath("/admin/frais-avances/parametres/conservation");
    return {
      success: true as const,
      message: result.alreadyApplied
        ? "Politique déjà activée (idempotent)"
        : `Politique v${draft.version} activée (prospectif)`,
      data: result,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false as const, error: error.errors[0]?.message ?? "Validation" };
    }
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erreur",
    };
  }
}

/**
 * Pose un legal hold sur une archive.
 */
export async function actionPoseLegalHoldArchive(form: {
  archiveId: string;
  motif: string;
  referenceDossier?: string;
  expiresAt?: string;
}) {
  if (!isNotesFraisEnabled()) return disabled();
  try {
    const userId = await requireSessionUserId();
    if (!(await canUserManageNotesFraisLegalHold(userId))) {
      return { success: false as const, error: "Accès refusé — ADMIN requis" };
    }
    const res = await poseLegalHoldOnArchive({
      archiveId: form.archiveId,
      motif: form.motif,
      referenceDossier: form.referenceDossier,
      expiresAt: form.expiresAt ? new Date(form.expiresAt) : null,
      poseParUserId: userId,
    });
    await logUserActivity(
      TypeActivite.Creation,
      "Pose legal hold archive notes de frais",
      "NoteFraisLegalHold",
      res.id,
      { cibleType: "ARCHIVE", archiveIdHash: form.archiveId.slice(0, 8) }
    );
    return { success: true as const, message: "Legal hold posé", data: res };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erreur",
    };
  } finally {
    revalidatePath("/admin/frais-avances/parametres/conservation");
  }
}

/**
 * Pose un legal hold sur une période journal (bloque P3).
 */
export async function actionPoseLegalHoldPeriode(form: {
  periodeCle: string;
  motif: string;
  referenceDossier?: string;
  expiresAt?: string;
}) {
  if (!isNotesFraisEnabled()) return disabled();
  try {
    const userId = await requireSessionUserId();
    if (!(await canUserManageNotesFraisLegalHold(userId))) {
      return { success: false as const, error: "Accès refusé — ADMIN requis" };
    }
    const res = await poseLegalHoldOnPeriode({
      periodeCle: form.periodeCle,
      motif: form.motif,
      referenceDossier: form.referenceDossier,
      expiresAt: form.expiresAt ? new Date(form.expiresAt) : null,
      poseParUserId: userId,
    });
    await logUserActivity(
      TypeActivite.Creation,
      "Pose legal hold période journal notes de frais",
      "NoteFraisLegalHold",
      res.id,
      { cibleType: "JOURNAL_PERIODE", periodeCle: form.periodeCle }
    );
    return { success: true as const, message: "Legal hold période posé", data: res };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erreur",
    };
  } finally {
    revalidatePath("/admin/frais-avances/parametres/conservation");
  }
}

/**
 * Lève un legal hold.
 */
export async function actionLeverLegalHold(form: { holdId: string }) {
  if (!isNotesFraisEnabled()) return disabled();
  try {
    const userId = await requireSessionUserId();
    if (!(await canUserManageNotesFraisLegalHold(userId))) {
      return { success: false as const, error: "Accès refusé — ADMIN requis" };
    }
    const res = await leverLegalHold({
      holdId: form.holdId,
      leveParUserId: userId,
    });
    await logUserActivity(
      TypeActivite.Modification,
      "Levée legal hold notes de frais",
      "NoteFraisLegalHold",
      res.id,
      { alreadyLeve: res.alreadyLeve }
    );
    return {
      success: true as const,
      message: res.alreadyLeve ? "Hold déjà levé" : "Legal hold levé",
      data: res,
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Erreur",
    };
  } finally {
    revalidatePath("/admin/frais-avances/parametres/conservation");
  }
}
