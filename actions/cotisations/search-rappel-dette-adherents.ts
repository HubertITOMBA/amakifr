"use server";

import { z } from "zod";
import { auth } from "@/auth";
import {
  canAccessPreviewRappelsDette,
  PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE,
} from "@/lib/services/cotisations/rappel-dette/preview-access";
import {
  RAPPEL_DETTE_ADHERENT_SEARCH_MIN_CHARS,
  searchRappelDetteAdherents,
  type RappelDetteAdherentSearchItem,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-adherent-search";

const SearchInputSchema = z
  .object({
    query: z
      .string()
      .trim()
      .min(
        RAPPEL_DETTE_ADHERENT_SEARCH_MIN_CHARS,
        `Saisissez au moins ${RAPPEL_DETTE_ADHERENT_SEARCH_MIN_CHARS} caractères`
      )
      .max(64, "Requête trop longue"),
  })
  .strict();

export type SearchRappelDetteAdherentsActionSuccess = {
  success: true;
  data: {
    query: string;
    items: RappelDetteAdherentSearchItem[];
    truncated: boolean;
    limit: number;
  };
};

export type SearchRappelDetteAdherentsActionFailure = {
  success: false;
  error: string;
  code: string;
};

export type SearchRappelDetteAdherentsActionResult =
  | SearchRappelDetteAdherentsActionSuccess
  | SearchRappelDetteAdherentsActionFailure;

/**
 * Server Action — recherche bornée d’adhérents pour opérations rappels.
 * ADMIN|PRESID uniquement. Aucune mutation. Pas de getAllUsersForAdmin.
 *
 * @param raw - `{ query }` strict
 */
export async function searchRappelDetteAdherentsAction(
  raw: unknown
): Promise<SearchRappelDetteAdherentsActionResult> {
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

    const parsed = SearchInputSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message ?? "Entrée invalide",
        code: "VALIDATION_ERROR",
      };
    }

    const result = await searchRappelDetteAdherents({
      actor: {
        userId: session.user.id,
        role: session.user.role,
      },
      query: parsed.data.query,
    });

    if (!result.ok) {
      return {
        success: false,
        error: result.message,
        code: result.code,
      };
    }

    return {
      success: true,
      data: {
        query: result.query,
        items: result.items,
        truncated: result.truncated,
        limit: result.limit,
      },
    };
  } catch (error) {
    console.error("[searchRappelDetteAdherentsAction]", {
      category: "unexpected",
      name: error instanceof Error ? error.name : "unknown",
    });
    return {
      success: false,
      error: "Erreur lors de la recherche d’adhérents",
      code: "INTERNAL",
    };
  }
}
