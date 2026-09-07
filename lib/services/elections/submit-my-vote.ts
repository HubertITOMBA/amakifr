import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { AuthContext } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import {
  canMemberVote,
  isElectionVotingOpen,
  resolveSelfAdherentId,
} from "@/lib/services/elections/election-helpers";
import type {
  SubmitMyVoteItem,
  SubmitMyVoteResultDto,
} from "@/lib/services/elections/types";

const VoteItemSchema = z.object({
  positionId: z.string().min(1),
  candidacyId: z.string().min(1).nullable(),
});

const SubmitSchema = z.object({
  votes: z.array(VoteItemSchema).min(1).max(50),
});

/**
 * Enregistre un ou plusieurs votes (1 choix / poste, blanc autorisé).
 * Miroir Web : status Ouverte, éligibilité, unicité DB.
 * Concurrence : create + catch P2002 → CONFLICT.
 * Ne logue jamais les choix.
 */
export async function submitMyVote(
  actor: AuthContext,
  electionId: string,
  payload: { votes: SubmitMyVoteItem[] }
): Promise<SubmitMyVoteResultDto> {
  const adherentId = await resolveSelfAdherentId(actor);
  const eligibility = await canMemberVote(adherentId);
  if (!eligibility.allowed) {
    throw new ServiceError(
      "FORBIDDEN",
      eligibility.reason || "Non éligible au vote"
    );
  }

  const parsed = SubmitSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ServiceError("VALIDATION_ERROR", "Bulletin invalide");
  }

  const election = await db.election.findUnique({
    where: { id: electionId },
    select: {
      id: true,
      status: true,
      dateScrutin: true,
      dateCloture: true,
      positions: { select: { id: true } },
    },
  });
  if (!election) {
    throw new ServiceError("NOT_FOUND", "Élection introuvable");
  }
  // Fenêtre réelle : Ouverte + [dateScrutin, dateCloture]
  if (!isElectionVotingOpen(election)) {
    throw new ServiceError(
      "CONFLICT",
      "L'élection n'est pas ouverte au vote"
    );
  }

  const positionIds = new Set(election.positions.map((p) => p.id));
  const seenPositions = new Set<string>();

  for (const item of parsed.data.votes) {
    if (seenPositions.has(item.positionId)) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        "Un seul choix par poste"
      );
    }
    seenPositions.add(item.positionId);
    if (!positionIds.has(item.positionId)) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        "Poste invalide pour cette élection"
      );
    }
    if (item.candidacyId) {
      const candidacy = await db.candidacy.findFirst({
        where: {
          id: item.candidacyId,
          electionId,
          positionId: item.positionId,
          status: "Validee",
        },
        select: { id: true },
      });
      if (!candidacy) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          "Candidat invalide pour ce poste"
        );
      }
    }
  }

  let recorded = 0;
  try {
    await db.$transaction(async (tx) => {
      for (const item of parsed.data.votes) {
        const existing = await tx.vote.findFirst({
          where: {
            electionId,
            positionId: item.positionId,
            adherentId,
          },
          select: { id: true },
        });
        if (existing) {
          throw new ServiceError(
            "CONFLICT",
            "Vous avez déjà voté pour ce poste"
          );
        }
        await tx.vote.create({
          data: {
            electionId,
            positionId: item.positionId,
            adherentId,
            candidacyId: item.candidacyId,
            status: item.candidacyId ? "Valide" : "Blanc",
          },
        });
        recorded += 1;
      }
    });
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ServiceError(
        "CONFLICT",
        "Vous avez déjà voté pour ce poste"
      );
    }
    console.error("[submitMyVote] Erreur:", (error as Error)?.name);
    throw new ServiceError("INTERNAL_ERROR", "Erreur lors du vote");
  }

  return {
    recorded,
    message:
      recorded === 1
        ? "Votre vote a été enregistré"
        : `${recorded} votes enregistrés`,
  };
}
