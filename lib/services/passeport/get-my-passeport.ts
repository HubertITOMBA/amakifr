import type { AuthContext } from "@/lib/auth-context";
import { ServiceError } from "@/lib/service-error";
import { loadMyPasseportRecord } from "@/lib/services/passeport/load-my-passeport-record";
import { toMyPasseportDto } from "@/lib/services/passeport/to-my-passeport-dto";
import type { MyPasseportDto } from "@/lib/services/passeport/types";

/**
 * Métadonnées passeport self-service de l'acteur authentifié.
 *
 * @throws {ServiceError} UNAUTHENTICATED | NOT_FOUND | FORBIDDEN | INTERNAL_ERROR
 */
export async function getMyPasseport(
  actor: AuthContext
): Promise<MyPasseportDto> {
  try {
    const record = await loadMyPasseportRecord(actor);
    return toMyPasseportDto(record);
  } catch (error) {
    if (error instanceof ServiceError) {
      throw error;
    }
    console.error("[getMyPasseport] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors de la récupération du passeport"
    );
  }
}
