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
  resumeRappelDetteNotification,
  type OrchestrateRappelDetteSendResult,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-orchestrate-send";

const ResumeInputSchema = z
  .object({
    envoiId: z.string().trim().min(1, "Identifiant d’envoi requis").max(64),
    adherentId: z.string().trim().min(1, "Adhérent requis").max(64),
  })
  .strict();

export type ResumeRappelDetteNotificationActionResult =
  | {
      success: true;
      data: Extract<OrchestrateRappelDetteSendResult, { ok: true }>;
    }
  | {
      success: false;
      error: string;
      code: string;
      nextHint?: "reconfirm" | "wait_or_ops" | "resume_notif" | "none";
      envoiId?: string;
      providerCallPerformed?: false;
    };

/**
 * Server Action — reprend uniquement la notification interne post-Accepted.
 *
 * Délègue à `resumeRappelDetteNotification` (correspondance envoi/adhérent
 * et prérequis Accepted gérés par le service existant). Aucun email / push.
 *
 * @param raw - `{ envoiId, adherentId }` strict
 */
export async function resumeRappelDetteNotificationAction(
  raw: unknown
): Promise<ResumeRappelDetteNotificationActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        error: PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE,
        code: "UNAUTHENTICATED",
        nextHint: "none",
        providerCallPerformed: false,
      };
    }
    if (!canAccessPreviewRappelsDette(session.user.role)) {
      return {
        success: false,
        error: PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE,
        code: "FORBIDDEN",
        nextHint: "none",
        providerCallPerformed: false,
      };
    }

    if (!isRappelDetteEnvoiEnabled()) {
      return {
        success: false,
        error: RAPPEL_DETTE_ENVOI_DISABLED_MESSAGE,
        code: "ENVOI_DISABLED",
        nextHint: "none",
        providerCallPerformed: false,
      };
    }

    const parsed = ResumeInputSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message ?? "Entrée invalide",
        code: "VALIDATION_ERROR",
        nextHint: "none",
        providerCallPerformed: false,
      };
    }

    const result = await resumeRappelDetteNotification({
      actor: {
        userId: session.user.id,
        role: session.user.role,
      },
      envoiId: parsed.data.envoiId,
      adherentId: parsed.data.adherentId,
    });

    if (!result.ok) {
      return {
        success: false,
        error: result.message,
        code: result.code,
        nextHint: result.nextHint,
        envoiId: result.envoiId,
        providerCallPerformed: false,
      };
    }

    return { success: true, data: result };
  } catch (error) {
    console.error("[resumeRappelDetteNotificationAction]", {
      category: "unexpected",
      name: error instanceof Error ? error.name : "unknown",
    });
    return {
      success: false,
      error: "Erreur lors de la reprise de notification",
      code: "INTERNAL",
      nextHint: "resume_notif",
      providerCallPerformed: false,
    };
  }
}
