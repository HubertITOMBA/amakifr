"use server";

import { z } from "zod";
import { auth } from "@/auth";
import {
  canAccessPreviewRappelsDette,
  PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE,
} from "@/lib/services/cotisations/rappel-dette/preview-access";
import {
  isRappelDetteEnvoiEnabled,
  RAPPEL_DETTE_ENVOI_DISABLED_MESSAGE,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-activation";
import {
  prepareRappelDetteConfirmation,
  type PrepareRappelDetteConfirmationResult,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-prepare-confirmation";

const PrepareInputSchema = z
  .object({
    adherentId: z.string().trim().min(1, "Adhérent requis").max(64),
  })
  .strict();

export type PrepareRappelDetteConfirmationActionSuccess = {
  success: true;
  data: {
    adherentId: string;
    clientConfirmationId: string;
    expectedFingerprint: string;
    gelsRevision: string;
    templateVersion: string;
    detteNette: string;
    referenceAt: string;
    referenceLabel: string;
    recipientMasked: string;
    prepareExpiresAt: string;
    confirmationToken: string;
  };
};

export type PrepareRappelDetteConfirmationActionFailure = {
  success: false;
  error: string;
  code: string;
  nextHint?: "reconfirm" | "wait_or_ops" | "none";
};

export type PrepareRappelDetteConfirmationActionResult =
  | PrepareRappelDetteConfirmationActionSuccess
  | PrepareRappelDetteConfirmationActionFailure;

function mapPrepareFailure(
  r: Extract<PrepareRappelDetteConfirmationResult, { ok: false }>
): PrepareRappelDetteConfirmationActionFailure {
  return {
    success: false,
    error: r.message,
    code: r.code,
    nextHint: r.nextHint ?? "none",
  };
}

/**
 * Server Action — prépare une confirmation d’envoi Lot 3 (sans mutation).
 *
 * Actor issu exclusivement de la session. Flag off → refus avant métier.
 * Aucun gel / montant / email / flag client accepté.
 *
 * @param raw - `{ adherentId }` uniquement (Zod strict)
 */
export async function prepareRappelDetteConfirmationAction(
  raw: unknown
): Promise<PrepareRappelDetteConfirmationActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        error: PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE,
        code: "UNAUTHENTICATED",
        nextHint: "none",
      };
    }
    if (!canAccessPreviewRappelsDette(session.user.role)) {
      return {
        success: false,
        error: PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE,
        code: "FORBIDDEN",
        nextHint: "none",
      };
    }

    // Flag avant toute lecture métier (défense en profondeur + service).
    if (!isRappelDetteEnvoiEnabled()) {
      return {
        success: false,
        error: RAPPEL_DETTE_ENVOI_DISABLED_MESSAGE,
        code: "ENVOI_DISABLED",
        nextHint: "none",
      };
    }

    const parsed = PrepareInputSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message ?? "Entrée invalide",
        code: "VALIDATION_ERROR",
        nextHint: "none",
      };
    }

    const result = await prepareRappelDetteConfirmation({
      actor: {
        userId: session.user.id,
        role: session.user.role,
      },
      adherentId: parsed.data.adherentId,
    });

    if (!result.ok) {
      return mapPrepareFailure(result);
    }

    return {
      success: true,
      data: {
        adherentId: result.adherentId,
        clientConfirmationId: result.clientConfirmationId,
        expectedFingerprint: result.expectedFingerprint,
        gelsRevision: result.gelsRevision,
        templateVersion: result.templateVersion,
        detteNette: result.detteNette,
        referenceAt: result.referenceAt,
        referenceLabel: result.referenceLabel,
        recipientMasked: result.recipientMasked,
        prepareExpiresAt: result.prepareExpiresAt,
        confirmationToken: result.confirmationToken,
      },
    };
  } catch (error) {
    console.error("[prepareRappelDetteConfirmationAction]", {
      category: "unexpected",
      name: error instanceof Error ? error.name : "unknown",
    });
    return {
      success: false,
      error: "Erreur lors de la préparation de confirmation",
      code: "INTERNAL",
      nextHint: "none",
    };
  }
}
