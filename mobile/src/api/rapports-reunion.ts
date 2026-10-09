import { authenticatedFetch } from "@/auth/session";
import type { MeetingReportDetailDto } from "@/api/types";

/**
 * GET /api/v1/me/rapports-reunion/[id] — détail d’un rapport PUBLISHED.
 * Lecture seule. Bearer via authenticatedFetch. Aucun userId/adherentId.
 *
 * @param rapportId - Identifiant du rapport (paramètre de route uniquement)
 */
export async function getPublishedRapport(
  rapportId: string
): Promise<MeetingReportDetailDto> {
  const id = String(rapportId ?? "").trim();
  if (!id) {
    throw new Error("Identifiant de rapport requis");
  }
  return authenticatedFetch<MeetingReportDetailDto>(
    `/api/v1/me/rapports-reunion/${encodeURIComponent(id)}`
  );
}
