import { authenticatedFetch } from "@/auth/session";
import type {
  CotisationMensuelleDto,
  MyCotisationYearDto,
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
 * GET /api/v1/me/cotisations/year?annee= — vue financière annuelle (lecture seule).
 */
export async function getMyCotisationYear(
  annee: number
): Promise<MyCotisationYearDto> {
  return authenticatedFetch<MyCotisationYearDto>(
    `/api/v1/me/cotisations/year?annee=${encodeURIComponent(String(annee))}`
  );
}
