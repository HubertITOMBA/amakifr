import type { AuthContext } from "@/lib/auth-context";
import { ServiceError } from "@/lib/service-error";
import { buildPasseportPdfBuffer } from "@/lib/services/passeport/build-passeport-pdf-buffer";
import { loadMyPasseportRecord } from "@/lib/services/passeport/load-my-passeport-record";
import type { MyPasseportPdfResult } from "@/lib/services/passeport/types";

/**
 * Génère le PDF passeport à la volée pour l'acteur authentifié.
 * Ne crée pas le numéro — précondition : numeroPasseport existant.
 *
 * @throws {ServiceError} UNAUTHENTICATED | NOT_FOUND | FORBIDDEN | CONFLICT | INTERNAL_ERROR
 */
export async function getMyPasseportPdf(
  actor: AuthContext
): Promise<MyPasseportPdfResult> {
  try {
    const record = await loadMyPasseportRecord(actor);

    if (!record.numeroPasseport) {
      throw new ServiceError(
        "CONFLICT",
        "Passeport non généré. Générez votre passeport avant de le télécharger."
      );
    }

    const buffer = await buildPasseportPdfBuffer(record);

    return {
      buffer,
      numeroPasseport: record.numeroPasseport,
      filename: `Passeport-AMAKI-${record.numeroPasseport}.pdf`,
    };
  } catch (error) {
    if (error instanceof ServiceError) {
      throw error;
    }
    console.error("[getMyPasseportPdf] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors de la génération du PDF passeport"
    );
  }
}
