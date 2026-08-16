import { authenticatedFetch } from "@/auth/session";
import type { CotisationMensuelleDto } from "@/api/types";

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
