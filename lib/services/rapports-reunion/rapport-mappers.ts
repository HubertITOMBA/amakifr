import type {
  MeetingReportDetailDto,
  MeetingReportMetaDto,
} from "@/lib/services/rapports-reunion/types";

type PublishedRow = {
  id: string;
  titre: string;
  reunionMensuelleId: string | null;
  dateReunion: Date;
  publishedAt: Date | null;
  updatedAt: Date;
  contenu?: string;
  CreatedBy: { name: string | null } | null;
};

/**
 * Mappe une ligne PUBLISHED vers les métadonnées publiques (sans HTML).
 */
export function mapPublishedRapportToMeta(row: PublishedRow): MeetingReportMetaDto {
  return {
    id: row.id,
    titre: row.titre,
    reunionMensuelleId: row.reunionMensuelleId,
    dateReunion: row.dateReunion ? row.dateReunion.toISOString() : null,
    authorDisplayName: row.CreatedBy?.name?.trim() || "Bureau AMAKI",
    publishedAt: (row.publishedAt ?? row.updatedAt).toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Mappe une ligne PUBLISHED vers le détail (avec HTML TipTap).
 */
export function mapPublishedRapportToDetail(
  row: PublishedRow & { contenu: string }
): MeetingReportDetailDto {
  return {
    ...mapPublishedRapportToMeta(row),
    contenuHtml: row.contenu,
  };
}
