"use server";

import { z } from "zod";
import { auth } from "@/auth";
import {
  canAccessPreviewRappelsDette,
  PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE,
} from "@/lib/services/cotisations/rappel-dette/preview-access";
import {
  listRappelDetteEnvoisByAdherent,
  RAPPEL_DETTE_ADMIN_READ_DEFAULT_PAGE_SIZE,
  RAPPEL_DETTE_ADMIN_READ_MAX_PAGE_SIZE,
  type AdminReadPage,
  type RappelDetteEnvoiListItem,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-admin-reads";

const ListEnvoisInputSchema = z
  .object({
    adherentId: z.string().trim().min(1, "Adhérent requis").max(64),
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(RAPPEL_DETTE_ADMIN_READ_MAX_PAGE_SIZE)
      .optional(),
    cursor: z.string().trim().min(1).max(512).nullish(),
  })
  .strict();

export type ListRappelDetteEnvoisActionResult =
  | { success: true; data: AdminReadPage<RappelDetteEnvoiListItem> }
  | { success: false; error: string; code: string };

/**
 * Server Action — historique paginé des envois rappel dette par adhérent.
 * Aucun email clair / token / secret. Flags off n’empêchent pas la lecture.
 *
 * @param raw - `{ adherentId, pageSize?, cursor? }` strict
 */
export async function listRappelDetteEnvoisAction(
  raw: unknown
): Promise<ListRappelDetteEnvoisActionResult> {
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

    const parsed = ListEnvoisInputSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message ?? "Entrée invalide",
        code: "VALIDATION_ERROR",
      };
    }

    const result = await listRappelDetteEnvoisByAdherent({
      actor: {
        userId: session.user.id,
        role: session.user.role,
      },
      adherentId: parsed.data.adherentId,
      pageSize:
        parsed.data.pageSize ?? RAPPEL_DETTE_ADMIN_READ_DEFAULT_PAGE_SIZE,
      cursor: parsed.data.cursor ?? null,
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
    console.error("[listRappelDetteEnvoisAction]", {
      category: "unexpected",
      name: error instanceof Error ? error.name : "unknown",
    });
    return {
      success: false,
      error: "Erreur lors de la lecture de l’historique des envois",
      code: "INTERNAL",
    };
  }
}
