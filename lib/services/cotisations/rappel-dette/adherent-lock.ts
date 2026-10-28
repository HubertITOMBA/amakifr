import type { Prisma } from "@prisma/client";

/**
 * Acquiert un verrou ligne adhérent (`SELECT … FOR UPDATE`) dans la TX courante.
 * Requête SQL paramétrée Prisma (pas de concaténation).
 *
 * @param tx - Client transactionnel
 * @param adherentId - Cible
 * @returns true si la ligne existe et est verrouillée ; false si adhérent absent
 */
export async function acquireAdherentRowLock(
  tx: Prisma.TransactionClient,
  adherentId: string
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM adherent WHERE id = ${adherentId} FOR UPDATE
  `;
  return rows.length > 0;
}
