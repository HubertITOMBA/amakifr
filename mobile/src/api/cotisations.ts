import { authenticatedFetch } from "@/auth/session";
import type {
  CotisationMensuelleDto,
  MyCotisationLinesPageDto,
  MyCotisationYearDto,
  MyPaymentsPageDto,
} from "@/api/types";

/**
 * GET /api/v1/me/cotisations-mensuelles
 * Self-service : aucun userId / adherentId client.
 */
export async function getMyCotisationsMensuelles(): Promise<
  CotisationMensuelleDto[]
> {
  return authenticatedFetch<CotisationMensuelleDto[]>(
    "/api/v1/me/cotisations-mensuelles"
  );
}

/**
 * GET /api/v1/me/cotisations/year?annee= — vue financière annuelle (sans historique).
 */
export async function getMyCotisationYear(
  annee: number
): Promise<MyCotisationYearDto> {
  return authenticatedFetch<MyCotisationYearDto>(
    `/api/v1/me/cotisations/year?annee=${encodeURIComponent(String(annee))}`
  );
}

export type GetMyPaymentsOptions = {
  annee?: number;
  limit?: number;
  offset?: number;
};

/**
 * Construit la query historique paiements (jamais userId / adherentId).
 */
export function buildMyPaymentsQuery(options: GetMyPaymentsOptions = {}): string {
  const params = new URLSearchParams();
  if (options.annee !== undefined) {
    params.set("annee", String(options.annee));
  }
  if (options.limit !== undefined) {
    params.set("limit", String(options.limit));
  }
  if (options.offset !== undefined) {
    params.set("offset", String(options.offset));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * GET /api/v1/me/cotisations/payments — historique paginé (lazy).
 */
export async function getMyPayments(
  options: GetMyPaymentsOptions = { limit: 20, offset: 0 }
): Promise<MyPaymentsPageDto> {
  const qs = buildMyPaymentsQuery(options);
  return authenticatedFetch<MyPaymentsPageDto>(
    `/api/v1/me/cotisations/payments${qs}`
  );
}

export type GetMyCotisationLinesOptions = {
  limit?: number;
  offset?: number;
};

/**
 * GET /api/v1/me/cotisations/lines — Toutes les années (paginé).
 */
export async function getMyCotisationLines(
  options: GetMyCotisationLinesOptions = { limit: 20, offset: 0 }
): Promise<MyCotisationLinesPageDto> {
  const params = new URLSearchParams();
  if (options.limit !== undefined) params.set("limit", String(options.limit));
  if (options.offset !== undefined) {
    params.set("offset", String(options.offset));
  }
  const qs = params.toString();
  return authenticatedFetch<MyCotisationLinesPageDto>(
    `/api/v1/me/cotisations/lines${qs ? `?${qs}` : ""}`
  );
}
