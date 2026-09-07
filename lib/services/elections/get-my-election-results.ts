import type { AuthContext } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import { resolveSelfAdherentId } from "@/lib/services/elections/election-helpers";
import type { MyElectionResultsDto } from "@/lib/services/elections/types";

/**
 * Résultats adhérent — uniquement si élection Cloturee (miroir /resultats Web).
 * Aucun adherentId électeur exposé.
 */
export async function getMyElectionResults(
  actor: AuthContext,
  electionId: string
): Promise<MyElectionResultsDto> {
  await resolveSelfAdherentId(actor);

  const election = await db.election.findUnique({
    where: { id: electionId },
    select: {
      id: true,
      titre: true,
      status: true,
      positions: {
        select: {
          id: true,
          titre: true,
          PosteTemplate: { select: { ordre: true } },
          candidacies: {
            where: { status: "Validee" },
            select: {
              id: true,
              adherent: {
                select: {
                  civility: true,
                  firstname: true,
                  lastname: true,
                },
              },
              _count: { select: { votes: true } },
            },
          },
          votes: {
            select: { status: true },
          },
        },
      },
    },
  });

  if (!election) {
    throw new ServiceError("NOT_FOUND", "Élection introuvable");
  }
  if (election.status !== "Cloturee") {
    throw new ServiceError(
      "FORBIDDEN",
      "Les résultats ne sont pas encore disponibles"
    );
  }

  const positions = [...election.positions].sort((a, b) => {
    const oa = a.PosteTemplate?.ordre ?? 999;
    const ob = b.PosteTemplate?.ordre ?? 999;
    if (oa !== ob) return oa - ob;
    return a.titre.localeCompare(b.titre, "fr");
  });

  return {
    electionId: election.id,
    titre: election.titre,
    positions: positions.map((p) => {
      const totalVotes = p.votes.length;
      const blankVotes = p.votes.filter((v) => v.status === "Blanc").length;
      const candidacies = p.candidacies
        .map((c) => {
          const votesCount = c._count.votes;
          return {
            candidacyId: c.id,
            displayName:
              `${c.adherent.civility ? c.adherent.civility + " " : ""}${c.adherent.firstname} ${c.adherent.lastname}`.trim(),
            votesCount,
            percentage:
              totalVotes > 0 ? (votesCount / totalVotes) * 100 : 0,
          };
        })
        .sort((a, b) => b.votesCount - a.votesCount);
      return {
        positionId: p.id,
        titre: p.titre,
        totalVotes,
        blankVotes,
        candidacies,
      };
    }),
  };
}
