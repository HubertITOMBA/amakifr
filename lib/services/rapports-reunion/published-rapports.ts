import { z } from "zod";
import { db } from "@/lib/db";
import type { AuthContext } from "@/lib/auth-context";
import { ServiceError } from "@/lib/service-error";
import { requireActiveAdherent } from "@/lib/services/rapports-reunion/require-active-adherent";
import {
  mapPublishedRapportToDetail,
  mapPublishedRapportToMeta,
} from "@/lib/services/rapports-reunion/rapport-mappers";
import type {
  MeetingReportDetailDto,
  MeetingReportsPageDto,
} from "@/lib/services/rapports-reunion/types";

const PageSchema = z.object({
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
});

export type ListPublishedRapportsOptions = {
  limit?: number;
  offset?: number;
};

const publishedSelectMeta = {
  id: true,
  titre: true,
  reunionMensuelleId: true,
  dateReunion: true,
  publishedAt: true,
  updatedAt: true,
  CreatedBy: { select: { name: true } },
} as const;

/**
 * Valide limit/offset (1–50 / ≥0). Erreur Zod → VALIDATION_ERROR (HTTP 400).
 *
 * @param options - Options de pagination optionnelles
 * @returns limit et offset normalisés
 * @throws {ServiceError} VALIDATION_ERROR si les paramètres sont invalides
 */
export function parsePublishedRapportsPageOptions(
  options: ListPublishedRapportsOptions = {}
): { limit: number; offset: number } {
  try {
    return PageSchema.parse({
      limit: options.limit,
      offset: options.offset,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        error.errors[0]?.message || "Pagination invalide"
      );
    }
    throw error;
  }
}

/**
 * Liste paginée des rapports PUBLISHED pour un adhérent actif.
 * Métadonnées uniquement (pas de contenu HTML).
 *
 * @param actor - Contexte d’authentification API
 * @param options - Pagination (limit 1–50, offset ≥ 0)
 * @returns Page de métadonnées sans contenu HTML
 * @throws {ServiceError} UNAUTHENTICATED | FORBIDDEN | NOT_FOUND | VALIDATION_ERROR | INTERNAL_ERROR
 */
export async function listPublishedRapportsForAdherent(
  actor: AuthContext,
  options: ListPublishedRapportsOptions = {}
): Promise<MeetingReportsPageDto> {
  await requireActiveAdherent(actor);

  const { limit, offset } = parsePublishedRapportsPageOptions(options);

  try {
    const where = { statut: "PUBLISHED" as const };
    const [total, rows] = await Promise.all([
      db.rapportReunion.count({ where }),
      db.rapportReunion.findMany({
        where,
        select: publishedSelectMeta,
        orderBy: [{ publishedAt: "desc" }, { dateReunion: "desc" }],
        take: limit,
        skip: offset,
      }),
    ]);

    return {
      items: rows.map(mapPublishedRapportToMeta),
      total,
      limit,
      offset,
    };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    console.error("[listPublishedRapportsForAdherent] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors de la récupération des rapports"
    );
  }
}

/**
 * Détail d’un rapport PUBLISHED. DRAFT ou ID inconnu → NOT_FOUND (non révélateur).
 */
export async function getPublishedRapportForAdherent(
  actor: AuthContext,
  rapportId: string
): Promise<MeetingReportDetailDto> {
  await requireActiveAdherent(actor);

  const id = String(rapportId ?? "").trim();
  if (!id) {
    throw new ServiceError("NOT_FOUND", "Rapport non trouvé");
  }

  try {
    const row = await db.rapportReunion.findFirst({
      where: { id, statut: "PUBLISHED" },
      select: {
        ...publishedSelectMeta,
        contenu: true,
      },
    });

    if (!row) {
      throw new ServiceError("NOT_FOUND", "Rapport non trouvé");
    }

    return mapPublishedRapportToDetail(row);
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    console.error("[getPublishedRapportForAdherent] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors de la récupération du rapport"
    );
  }
}
