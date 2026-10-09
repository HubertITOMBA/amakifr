import { canOpenPublishedReport } from "@/api/rapports-reunion-state";
import type { MyReunionDto } from "@/api/types";

/**
 * Construit le chemin Expo Router vers le lecteur (ID uniquement).
 */
export function buildRapportRoute(rapportId: string): string {
  return `/reunions/rapport/${encodeURIComponent(String(rapportId).trim())}`;
}

/**
 * Route depuis une réunion — null si badge absent.
 */
export function rapportRouteFromReunion(
  reunion: Pick<MyReunionDto, "hasPublishedReport" | "publishedReportId">
): string | null {
  if (!canOpenPublishedReport(reunion) || !reunion.publishedReportId) {
    return null;
  }
  return buildRapportRoute(reunion.publishedReportId);
}

/**
 * Scan source complémentaire : détecte des motifs de log dangereux dans un fichier.
 * Les tests comportementaux restent l’autorité.
 */
export function sourceLooksLikeItLogsHtmlOrToken(source: string): boolean {
  const s = source.toLowerCase();
  const logsHtml =
    /console\.(log|debug|info|warn).*contenuhtml/.test(s) ||
    /console\.(log|debug|info|warn).*html/.test(s);
  const logsToken =
    /console\.(log|debug|info|warn).*(accesstoken|bearer|authorization)/.test(
      s
    );
  return logsHtml || logsToken;
}
