"use server";

import { z } from "zod";
import { auth } from "@/auth";
import {
  canAccessPreviewRappelsDette,
  PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE,
} from "@/lib/services/cotisations/rappel-dette/preview-access";
import {
  isRappelDetteGelMutationEnabled,
  RAPPEL_DETTE_GEL_MUTATION_DISABLED_MESSAGE,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-gel-mutation-activation";
import {
  poseRappelDetteGel,
  type GelMutationResult,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-gel-mutate";

const MotifCodeSchema = z.enum([
  "CONTESTATION",
  "VERIFICATION_ADMINISTRATIVE",
  "AUTRE",
]);

/**
 * Entrée publique pose : cible + motif uniquement.
 * Zod `.strict()` refuse actor / flag / poseParUserId / gelsRevision / deps.
 */
const PoseAdherentSchema = z
  .object({
    scope: z.literal("ADHERENT"),
    adherentId: z.string().trim().min(1, "Adhérent requis").max(64),
    motifCode: MotifCodeSchema,
    motifTexte: z
      .string()
      .trim()
      .min(1, "Commentaire motif obligatoire")
      .max(500),
    referenceDossier: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .nullish(),
  })
  .strict();

const PoseLigneSchema = z
  .object({
    scope: z.literal("LIGNE"),
    adherentId: z.string().trim().min(1, "Adhérent requis").max(64),
    lineSource: z.enum(["cotisation_mensuelle", "dette_initiale"]),
    cotisationMensuelleId: z.string().trim().min(1).max(64).optional(),
    detteInitialeId: z.string().trim().min(1).max(64).optional(),
    motifCode: MotifCodeSchema,
    motifTexte: z
      .string()
      .trim()
      .min(1, "Commentaire motif obligatoire")
      .max(500),
    referenceDossier: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .nullish(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.lineSource === "cotisation_mensuelle") {
      if (!val.cotisationMensuelleId || val.detteInitialeId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Ligne cotisation mensuelle exclusive requise",
          path: ["cotisationMensuelleId"],
        });
      }
    } else if (!val.detteInitialeId || val.cotisationMensuelleId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Ligne dette initiale exclusive requise",
        path: ["detteInitialeId"],
      });
    }
  });

const PoseInputSchema = z.union([PoseAdherentSchema, PoseLigneSchema]);

export type PoseRappelDetteGelActionResult =
  | {
      success: true;
      data: {
        outcome: "posed" | "already_active";
        gelId: string;
        adherentId: string;
        scope: "ADHERENT" | "LIGNE";
        statut: "ACTIF" | "LEVE";
        gelsRevision: string;
      };
    }
  | {
      success: false;
      error: string;
      code: string;
    };

function mapPoseFailure(
  r: Extract<GelMutationResult, { ok: false }>
): PoseRappelDetteGelActionResult {
  return { success: false, error: r.message, code: r.code };
}

/**
 * Server Action — pose un gel rappel dette (sans UI).
 *
 * Actor / flag issus exclusivement de la session et de la config serveur.
 * Indépendant du flag d’envoi.
 *
 * @param raw - Cible + motif (Zod strict)
 */
export async function poseRappelDetteGelAction(
  raw: unknown
): Promise<PoseRappelDetteGelActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        error: PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE,
        code: "UNAUTHENTICATED",
      };
    }
    if (!canAccessPreviewRappelsDette(session.user.role)) {
      return {
        success: false,
        error: PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE,
        code: "FORBIDDEN",
      };
    }

    if (!isRappelDetteGelMutationEnabled()) {
      return {
        success: false,
        error: RAPPEL_DETTE_GEL_MUTATION_DISABLED_MESSAGE,
        code: "GEL_MUTATION_DISABLED",
      };
    }

    const parsed = PoseInputSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message ?? "Entrée invalide",
        code: "VALIDATION_ERROR",
      };
    }

    const data = parsed.data;
    const target =
      data.scope === "ADHERENT"
        ? { scope: "ADHERENT" as const, adherentId: data.adherentId }
        : {
            scope: "LIGNE" as const,
            adherentId: data.adherentId,
            lineSource: data.lineSource,
            cotisationMensuelleId: data.cotisationMensuelleId,
            detteInitialeId: data.detteInitialeId,
          };

    const result = await poseRappelDetteGel({
      actor: {
        userId: session.user.id,
        role: session.user.role,
      },
      target,
      motifCode: data.motifCode,
      motifTexte: data.motifTexte,
      referenceDossier: data.referenceDossier ?? null,
    });

    if (!result.ok) {
      return mapPoseFailure(result);
    }

    if (
      result.outcome !== "posed" &&
      result.outcome !== "already_active"
    ) {
      return {
        success: false,
        error: "Résultat de pose inattendu",
        code: "INTERNAL_ERROR",
      };
    }

    return {
      success: true,
      data: {
        outcome: result.outcome,
        gelId: result.gelId,
        adherentId: result.adherentId,
        scope: result.scope,
        statut: result.statut,
        gelsRevision: result.gelsRevision,
      },
    };
  } catch (error) {
    console.error("[poseRappelDetteGelAction]", {
      category: "unexpected",
      name: error instanceof Error ? error.name : "unknown",
    });
    return {
      success: false,
      error: "Erreur lors de la pose du gel",
      code: "INTERNAL",
    };
  }
}
