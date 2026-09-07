import { z } from "zod";
import { Prisma } from "@prisma/client";
import type { AuthContext } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import {
  canMemberBeCandidate,
  getCandidacyWithdrawalBlockReason,
  isElectionCandidacyOpen,
  resolveSelfAdherentId,
} from "@/lib/services/elections/election-helpers";
import type {
  SubmitMyCandidacyResultDto,
  WithdrawMyCandidacyResultDto,
} from "@/lib/services/elections/types";

const SubmitSchema = z.object({
  motivation: z.string().trim().min(1, "Motivation obligatoire").max(10000),
  programme: z.string().trim().min(1, "Programme obligatoire").max(10000),
});

/**
 * Se porter candidat à un poste (self).
 * Miroir Web createCandidacy / createMultipleCandidacies (1 poste).
 * Multi-postes autorisé au niveau élection (1 candidature / poste).
 */
export async function submitMyCandidacy(
  actor: AuthContext,
  electionId: string,
  positionId: string,
  payload: { motivation: string; programme: string }
): Promise<SubmitMyCandidacyResultDto> {
  const adherentId = await resolveSelfAdherentId(actor);
  const eligibility = await canMemberBeCandidate(adherentId);
  if (!eligibility.allowed) {
    throw new ServiceError(
      "FORBIDDEN",
      eligibility.reason || "Non éligible à la candidature"
    );
  }

  const parsed = SubmitSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      parsed.error.errors[0]?.message || "Motivation et programme obligatoires"
    );
  }

  const election = await db.election.findUnique({
    where: { id: electionId },
    select: {
      id: true,
      status: true,
      dateOuverture: true,
      dateClotureCandidature: true,
    },
  });
  if (!election) {
    throw new ServiceError("NOT_FOUND", "Élection introuvable");
  }
  if (!isElectionCandidacyOpen(election)) {
    throw new ServiceError(
      "CONFLICT",
      "La période de candidature n'est pas ouverte"
    );
  }

  const position = await db.position.findFirst({
    where: { id: positionId, electionId },
    select: { id: true },
  });
  if (!position) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      "Le poste sélectionné n'existe pas pour cette élection"
    );
  }

  const existing = await db.candidacy.findFirst({
    where: { adherentId, electionId, positionId },
    select: { id: true, status: true },
  });
  if (existing) {
    throw new ServiceError(
      "CONFLICT",
      "Vous avez déjà postulé pour ce poste dans cette élection."
    );
  }

  try {
    const candidacy = await db.candidacy.create({
      data: {
        electionId,
        positionId,
        adherentId,
        motivation: parsed.data.motivation,
        programme: parsed.data.programme,
        status: "EnAttente",
      },
      select: { id: true, status: true },
    });

    return {
      id: candidacy.id,
      status: candidacy.status,
      message: "Candidature soumise — en attente de validation",
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ServiceError(
        "CONFLICT",
        "Vous avez déjà postulé pour ce poste dans cette élection."
      );
    }
    throw error;
  }
}

/**
 * Retire (supprime) la candidature self pour un poste.
 *
 * Verrous métier (Web + mobile) :
 * - élection Ouverte
 * - now < dateScrutin
 * - aucun Vote sur la candidature
 *
 * Protection concurrence : SELECT FOR UPDATE + re-contrôle votes
 * dans une transaction (FK Vote → Candidacy = ON DELETE SET NULL,
 * donc le verrou applicatif est critique).
 */
export async function withdrawMyCandidacy(
  actor: AuthContext,
  electionId: string,
  positionId: string
): Promise<WithdrawMyCandidacyResultDto> {
  const adherentId = await resolveSelfAdherentId(actor);

  const election = await db.election.findUnique({
    where: { id: electionId },
    select: { id: true, status: true, dateScrutin: true },
  });
  if (!election) {
    throw new ServiceError("NOT_FOUND", "Élection introuvable");
  }

  const candidacy = await db.candidacy.findFirst({
    where: { adherentId, electionId, positionId },
    select: { id: true, status: true, adherentId: true },
  });
  if (!candidacy) {
    throw new ServiceError("NOT_FOUND", "Candidature introuvable");
  }

  const now = new Date();
  const preVotes = await db.vote.count({
    where: { candidacyId: candidacy.id },
  });
  const preReason = getCandidacyWithdrawalBlockReason({
    electionStatus: election.status,
    myCandidacyStatus: candidacy.status,
    dateScrutin: election.dateScrutin,
    hasVotesOnCandidacy: preVotes > 0,
    now,
  });
  if (preReason) {
    throw new ServiceError("CONFLICT", preReason);
  }

  try {
    await db.$transaction(async (tx) => {
      // Verrouille la ligne candidature : un vote concurrent attend / échoue.
      await tx.$queryRaw`
        SELECT id FROM candidacies WHERE id = ${candidacy.id} FOR UPDATE
      `;

      const locked = await tx.candidacy.findUnique({
        where: { id: candidacy.id },
        select: {
          id: true,
          status: true,
          adherentId: true,
          election: { select: { status: true, dateScrutin: true } },
        },
      });
      if (!locked || locked.adherentId !== adherentId) {
        throw new ServiceError("NOT_FOUND", "Candidature introuvable");
      }

      const voteCount = await tx.vote.count({
        where: { candidacyId: locked.id },
      });
      const reason = getCandidacyWithdrawalBlockReason({
        electionStatus: locked.election.status,
        myCandidacyStatus: locked.status,
        dateScrutin: locked.election.dateScrutin,
        hasVotesOnCandidacy: voteCount > 0,
        now: new Date(),
      });
      if (reason) {
        throw new ServiceError("CONFLICT", reason);
      }

      await tx.candidacy.delete({ where: { id: locked.id } });
    });
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2003" || error.code === "P2014")
    ) {
      throw new ServiceError(
        "CONFLICT",
        "Impossible de retirer cette candidature : des votes ont déjà été enregistrés"
      );
    }
    console.error("[withdrawMyCandidacy] Erreur:", (error as Error)?.name);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors du retrait de candidature"
    );
  }

  return {
    withdrawn: true,
    message: "Candidature retirée",
  };
}
