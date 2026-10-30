"use server";

import { z } from "zod";
import { auth } from "@/auth";
import {
  canAccessPreviewRappelsDette,
  PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE,
} from "@/lib/services/cotisations/rappel-dette/preview-access";
import {
  getRappelDetteAdminCapabilities,
  type RappelDetteAdminCapabilities,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-admin-reads";

/** Entrée vide stricte — refuse actor / flag / secrets client. */
const CapabilitiesInputSchema = z.object({}).strict();

export type GetRappelDetteAdminCapabilitiesActionResult =
  | { success: true; data: RappelDetteAdminCapabilities }
  | { success: false; error: string; code: string };

/**
 * Server Action — capacités Lot 3 (booléens flags serveur).
 * Lectures autorisées même si flags off ; aucune mutation.
 *
 * @param raw - `{}` strict (optionnel)
 */
export async function getRappelDetteAdminCapabilitiesAction(
  raw: unknown = {}
): Promise<GetRappelDetteAdminCapabilitiesActionResult> {
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

    const parsed = CapabilitiesInputSchema.safeParse(raw ?? {});
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message ?? "Entrée invalide",
        code: "VALIDATION_ERROR",
      };
    }

    const result = getRappelDetteAdminCapabilities({
      userId: session.user.id,
      role: session.user.role,
    });

    if (!result.ok) {
      return {
        success: false,
        error: result.message,
        code: result.code,
      };
    }

    return { success: true, data: result.data };
  } catch (error) {
    console.error("[getRappelDetteAdminCapabilitiesAction]", {
      category: "unexpected",
      name: error instanceof Error ? error.name : "unknown",
    });
    return {
      success: false,
      error: "Erreur lors de la lecture des capacités",
      code: "INTERNAL",
    };
  }
}
