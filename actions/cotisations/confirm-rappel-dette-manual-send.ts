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
import { verifyRappelDetteConfirmationToken } from "@/lib/services/cotisations/rappel-dette/rappel-dette-confirmation-token";
import {
  orchestrateRappelDetteSend,
  RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2,
  type OrchestrateRappelDetteSendResult,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-orchestrate-send";
import { buildSelectedRappelDetteServerTransport } from "@/lib/services/cotisations/rappel-dette/rappel-dette-server-transports";

/**
 * Entrée publique confirm : **jeton uniquement**.
 * Zod `.strict()` refuse montant/email/provider/gel/flag/deps/fingerprint client, etc.
 */
const ConfirmInputSchema = z
  .object({
    confirmationToken: z
      .string()
      .trim()
      .min(1, "Jeton de confirmation requis")
      .max(4096),
  })
  .strict();

export type ConfirmRappelDetteManualSendActionResult =
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
      reservationStatus?: string;
      providerCallPerformed?: false;
    };

/**
 * Server Action — confirme l’envoi manuel via l’orchestrateur existant.
 *
 * Claims du jeton (pas les copies client) : adherentId, fingerprint,
 * clientConfirmationId, template v2. Transport construit serveur pour le
 * kind sélectionné uniquement — sans verify() / réseau à la construction.
 *
 * Unknown / persist-fail : laissés bloquants par l’orchestrateur (pas de renvoi).
 *
 * @param raw - `{ confirmationToken }` strict
 */
export async function confirmRappelDetteManualSendAction(
  raw: unknown
): Promise<ConfirmRappelDetteManualSendActionResult> {
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

    const parsed = ConfirmInputSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message ?? "Entrée invalide",
        code: "VALIDATION_ERROR",
        nextHint: "none",
        providerCallPerformed: false,
      };
    }

    const verified = verifyRappelDetteConfirmationToken({
      token: parsed.data.confirmationToken,
      actorUserId: session.user.id,
    });

    if (!verified.ok) {
      const nextHint =
        verified.code === "CONFIRMATION_TOKEN_EXPIRED" ||
        verified.code === "CONFIRMATION_TOKEN_NOT_YET_VALID" ||
        verified.code === "CONFIRMATION_TOKEN_DURATION_INVALID"
          ? "reconfirm"
          : verified.code === "CONFIRMATION_TOKEN_ACTOR_MISMATCH"
            ? "none"
            : "reconfirm";
      return {
        success: false,
        error: verified.message,
        code: verified.code,
        nextHint,
        providerCallPerformed: false,
      };
    }

    const claims = verified.claims;
    if (claims.templateVersion !== RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2) {
      return {
        success: false,
        error: "Template de confirmation invalide",
        code: "VALIDATION_ERROR",
        nextHint: "reconfirm",
        providerCallPerformed: false,
      };
    }

    const transport = buildSelectedRappelDetteServerTransport();
    if (!transport.ok) {
      return {
        success: false,
        error: transport.message,
        code: transport.code,
        nextHint: "wait_or_ops",
        providerCallPerformed: false,
      };
    }

    const orch = await orchestrateRappelDetteSend({
      actor: {
        userId: session.user.id,
        role: session.user.role,
      },
      adherentId: claims.adherentId,
      clientConfirmationId: claims.clientConfirmationId,
      expectedFingerprint: claims.fingerprint,
      expectedGelsRevision: claims.gelsRevision,
      templateVersion: RAPPEL_DETTE_ORCHESTRATE_TEMPLATE_V2,
      smtpTransport: transport.smtpTransport,
      resendTransport: transport.resendTransport,
    });

    if (!orch.ok) {
      return {
        success: false,
        error: orch.message,
        code: orch.code,
        nextHint: orch.nextHint,
        envoiId: orch.envoiId,
        reservationStatus: orch.reservationStatus,
        providerCallPerformed: false,
      };
    }

    return { success: true, data: orch };
  } catch (error) {
    console.error("[confirmRappelDetteManualSendAction]", {
      category: "unexpected",
      name: error instanceof Error ? error.name : "unknown",
    });
    return {
      success: false,
      error: "Erreur lors de la confirmation d’envoi",
      code: "INTERNAL",
      nextHint: "wait_or_ops",
      providerCallPerformed: false,
    };
  }
}
