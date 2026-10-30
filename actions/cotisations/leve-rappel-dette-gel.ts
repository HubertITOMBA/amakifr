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
  leveRappelDetteGel,
  type GelMutationResult,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-gel-mutate";

/**
 * Entrée publique levée : gelId + adherentId uniquement.
 * Zod `.strict()` refuse actor / flag / motif / leveParUserId / deps.
 */
const LeveInputSchema = z
  .object({
    adherentId: z.string().trim().min(1, "Adhérent requis").max(64),
    gelId: z.string().trim().min(1, "Identifiant de gel requis").max(64),
  })
  .strict();

export type LeveRappelDetteGelActionResult =
  | {
      success: true;
      data: {
        outcome: "lifted" | "already_lifted";
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

function mapLeveFailure(
  r: Extract<GelMutationResult, { ok: false }>
): LeveRappelDetteGelActionResult {
  return { success: false, error: r.message, code: r.code };
}

/**
 * Server Action — lève un gel rappel dette (sans UI, sans nouveau motif).
 *
 * Actor / flag issus exclusivement de la session et de la config serveur.
 * Indépendant du flag d’envoi.
 *
 * @param raw - `{ adherentId, gelId }` strict
 */
export async function leveRappelDetteGelAction(
  raw: unknown
): Promise<LeveRappelDetteGelActionResult> {
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

    const parsed = LeveInputSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message ?? "Entrée invalide",
        code: "VALIDATION_ERROR",
      };
    }

    const result = await leveRappelDetteGel({
      actor: {
        userId: session.user.id,
        role: session.user.role,
      },
      adherentId: parsed.data.adherentId,
      gelId: parsed.data.gelId,
    });

    if (!result.ok) {
      return mapLeveFailure(result);
    }

    if (
      result.outcome !== "lifted" &&
      result.outcome !== "already_lifted"
    ) {
      return {
        success: false,
        error: "Résultat de levée inattendu",
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
    console.error("[leveRappelDetteGelAction]", {
      category: "unexpected",
      name: error instanceof Error ? error.name : "unknown",
    });
    return {
      success: false,
      error: "Erreur lors de la levée du gel",
      code: "INTERNAL",
    };
  }
}
