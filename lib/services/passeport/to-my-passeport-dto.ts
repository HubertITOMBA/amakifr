import type { MyPasseportDto } from "@/lib/services/passeport/types";
import type { MyPasseportRecord } from "@/lib/services/passeport/load-my-passeport-record";

/**
 * Mappe un enregistrement adhérent actif vers le DTO metadata.
 */
export function toMyPasseportDto(record: MyPasseportRecord): MyPasseportDto {
  const disponible = record.userStatus === "Actif";
  const peutGenerer = disponible && !record.numeroPasseport;

  return {
    numeroPasseport: record.numeroPasseport,
    dateGenerationPasseport: record.dateGenerationPasseport?.toISOString() ?? null,
    disponible,
    peutGenerer,
  };
}
