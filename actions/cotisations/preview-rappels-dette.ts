"use server";

import { auth } from "@/auth";
import { isServiceError } from "@/lib/service-error";
import {
  canAccessPreviewRappelsDette,
  PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE,
} from "@/lib/services/cotisations/rappel-dette/preview-access";
import {
  previewRappelsDetteAdmin,
  type PreviewRappelsDetteResult,
} from "@/lib/services/cotisations/rappel-dette/preview-rappels-admin";

export type PreviewRappelsDetteActionResult =
  | { success: true; data: PreviewRappelsDetteResult }
  | { success: false; error: string; code?: "UNAUTHENTICATED" | "FORBIDDEN" | "INTERNAL" };

/**
 * Server Action — prévisualisation dry-run des rappels cotisations/dettes.
 *
 * Lecture seule. Aucun paramètre client (gel, échéance, etc.) n’est accepté.
 * Garde ADMIN|PRESID obligatoire avant toute lecture métier.
 *
 * @returns Résultat de prévisualisation ou erreur d’autorisation
 */
export async function getPreviewRappelsDetteAction(): Promise<PreviewRappelsDetteActionResult> {
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

    const data = await previewRappelsDetteAdmin({
      userId: session.user.id,
      role: session.user.role,
    });

    return { success: true, data };
  } catch (error) {
    if (isServiceError(error)) {
      if (error.code === "UNAUTHENTICATED" || error.code === "FORBIDDEN") {
        return {
          success: false,
          error: PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE,
          code: error.code === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : "FORBIDDEN",
        };
      }
      return {
        success: false,
        error: error.message,
        code: "INTERNAL",
      };
    }
    console.error("[getPreviewRappelsDetteAction]", {
      category: "unexpected",
      name: error instanceof Error ? error.name : "unknown",
    });
    return {
      success: false,
      error: "Erreur lors de la prévisualisation",
      code: "INTERNAL",
    };
  }
}
