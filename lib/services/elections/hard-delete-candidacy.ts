import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";

/**
 * Hard-delete d'une candidature avec verrou intégrité votes.
 *
 * Critique : Vote.candidacyId est ON DELETE SET NULL — supprimer une
 * candidature déjà votée transformerait silencieusement des suffrages
 * nominatifs en « blanc ».
 *
 * Ne vérifie PAS dateScrutin / ownership (usage admin ou interne).
 * Le self-service doit passer par `withdrawMyCandidacy`.
 *
 * @param candidacyId - Identifiant de la candidature
 * @throws {ServiceError} NOT_FOUND | CONFLICT
 */
export async function hardDeleteCandidacyGuardingVotes(
  candidacyId: string
): Promise<{ deleted: true }> {
  try {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM candidacies WHERE id = ${candidacyId} FOR UPDATE
      `;

      const candidacy = await tx.candidacy.findUnique({
        where: { id: candidacyId },
        select: { id: true },
      });
      if (!candidacy) {
        throw new ServiceError("NOT_FOUND", "Candidature introuvable");
      }

      const voteCount = await tx.vote.count({
        where: { candidacyId },
      });
      if (voteCount > 0) {
        throw new ServiceError(
          "CONFLICT",
          "Impossible de supprimer cette candidature : des votes ont déjà été enregistrés"
        );
      }

      await tx.candidacy.delete({ where: { id: candidacyId } });
    });
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2003" || error.code === "P2014")
    ) {
      throw new ServiceError(
        "CONFLICT",
        "Impossible de supprimer cette candidature : des votes ont déjà été enregistrés"
      );
    }
    console.error(
      "[hardDeleteCandidacyGuardingVotes] Erreur:",
      (error as Error)?.name
    );
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors de la suppression de candidature"
    );
  }

  return { deleted: true };
}
