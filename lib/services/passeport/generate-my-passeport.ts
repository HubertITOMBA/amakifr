import { db } from "@/lib/db";
import type { AuthContext } from "@/lib/auth-context";
import { ServiceError } from "@/lib/service-error";
import { generateNumeroPasseport } from "@/lib/passeport-helpers";
import { loadMyPasseportRecord } from "@/lib/services/passeport/load-my-passeport-record";
import { toMyPasseportDto } from "@/lib/services/passeport/to-my-passeport-dto";
import type { MyPasseportDto } from "@/lib/services/passeport/types";

/**
 * Génère le numéro passeport self-service si absent (idempotent si déjà présent).
 * N'envoie pas d'email — réservé au flux admin.
 *
 * @throws {ServiceError} UNAUTHENTICATED | NOT_FOUND | FORBIDDEN | INTERNAL_ERROR
 */
export async function generateMyPasseport(
  actor: AuthContext
): Promise<MyPasseportDto> {
  try {
    const record = await loadMyPasseportRecord(actor);

    if (record.numeroPasseport) {
      return toMyPasseportDto(record);
    }

    const numeroPasseport = generateNumeroPasseport(
      record.adherentId,
      record.userCreatedAt ?? new Date()
    );
    const dateGenerationPasseport = new Date();

    const updated = await db.adherent.update({
      where: { id: record.adherentId },
      data: {
        numeroPasseport,
        dateGenerationPasseport,
      },
      select: {
        numeroPasseport: true,
        dateGenerationPasseport: true,
      },
    });

    return toMyPasseportDto({
      ...record,
      numeroPasseport: updated.numeroPasseport,
      dateGenerationPasseport: updated.dateGenerationPasseport,
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      throw error;
    }
    console.error("[generateMyPasseport] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors de la génération du passeport"
    );
  }
}
