/**
 * DTOs rapports de réunion — lecture adhérent / admin.
 * Le HTML TipTap est transporté tel quel ; M2-D devra le sanitiser côté client.
 */

export type MeetingReportMetaDto = {
  id: string;
  titre: string;
  reunionMensuelleId: string | null;
  dateReunion: string | null;
  authorDisplayName: string;
  publishedAt: string;
  updatedAt: string;
};

export type MeetingReportDetailDto = MeetingReportMetaDto & {
  /** HTML TipTap stocké — ne pas exécuter côté serveur ; sanitiser en M2-D / web. */
  contenuHtml: string;
};

export type MeetingReportsPageDto = {
  items: MeetingReportMetaDto[];
  total: number;
  limit: number;
  offset: number;
};

export type AdminRapportReunionDto = {
  id: string;
  titre: string;
  dateReunion: string;
  contenu: string;
  reunionMensuelleId: string | null;
  statut: "DRAFT" | "PUBLISHED";
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  CreatedBy: { id: string; name: string | null; email: string | null } | null;
  UpdatedBy: { id: string; name: string | null; email: string | null } | null;
  ReunionMensuelle: {
    id: string;
    annee: number;
    mois: number;
    dateReunion: Date | string | null;
  } | null;
};
