/**
 * Résolution du TypeDepense technique des notes de frais (lot 4.0).
 * Aucune création runtime métier — seed/fixture tests uniquement.
 */
import type { PrismaClient, TypeDepense } from "@prisma/client";
import type { db } from "@/lib/db";

export const TYPE_DEPENSE_CODE_FRAIS_AVANCE = "FRAIS_AVANCE" as const;

export const NOTES_FRAIS_TYPE_DEPENSE_ABSENT =
  "Type de dépense FRAIS_AVANCE introuvable ou inactif — seed/test requis";

/** Erreur métier stable — CRUD admin (suppression / désactivation / code). */
export const TYPE_DEPENSE_FRAIS_AVANCE_PROTECTED =
  "Type de dépense technique FRAIS_AVANCE protégé — suppression, désactivation ou modification du code interdites";

/**
 * True si le type est le type technique notes de frais (identification par code uniquement).
 *
 * @param code - Code technique éventuel du TypeDepense
 */
export function isTypeDepenseFraisAvanceCode(
  code: string | null | undefined
): boolean {
  return code === TYPE_DEPENSE_CODE_FRAIS_AVANCE;
}
type TypeDepenseClient = Pick<
  PrismaClient["typeDepense"],
  "findFirst" | "create" | "update"
>;

type DbLike = {
  typeDepense: TypeDepenseClient;
};

/**
 * Résout le TypeDepense actif `code=FRAIS_AVANCE` (resolve-only).
 *
 * @param client - Client Prisma / TX
 * @returns Type trouvé ou null
 */
export async function findActiveTypeDepenseFraisAvance(
  client: DbLike | typeof db
): Promise<TypeDepense | null> {
  return client.typeDepense.findFirst({
    where: {
      code: TYPE_DEPENSE_CODE_FRAIS_AVANCE,
      actif: true,
    },
  });
}

/**
 * Fixture idempotente **réservée aux tests** : crée ou réactive
 * TypeDepense `code=FRAIS_AVANCE`. Ne jamais appeler depuis le runtime métier.
 *
 * @param client - Client Prisma de test
 * @param createdByUserId - User créateur (FK required)
 * @returns TypeDepense actif FRAIS_AVANCE
 */
export async function ensureTypeDepenseFraisAvanceForTests(
  client: DbLike,
  createdByUserId: string
): Promise<TypeDepense> {
  const existing = await client.typeDepense.findFirst({
    where: { code: TYPE_DEPENSE_CODE_FRAIS_AVANCE },
  });
  if (existing) {
    if (!existing.actif) {
      return client.typeDepense.update({
        where: { id: existing.id },
        data: { actif: true },
      });
    }
    return existing;
  }
  return client.typeDepense.create({
    data: {
      titre: "Frais avancés",
      description: "Type technique notes de frais (fixture tests)",
      code: TYPE_DEPENSE_CODE_FRAIS_AVANCE,
      actif: true,
      createdBy: createdByUserId,
    },
  });
}
