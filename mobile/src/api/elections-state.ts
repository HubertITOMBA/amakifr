import type { ApiClientError, MyElectionPositionDto } from "@/api/types";

/**
 * CTA accueil : au moins une élection ouverte à voter.
 */
export function shouldShowHomeElectionsBanner(aVoterCount: number): boolean {
  return aVoterCount > 0;
}

/**
 * Indication légère Home : candidatures ouvertes.
 */
export function shouldShowHomeCandidaciesHint(
  candidaciesOpenCount: number
): boolean {
  return candidaciesOpenCount > 0;
}

/**
 * Message d'erreur API élections.
 */
export function electionErrorMessage(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as ApiClientError).message === "string"
  ) {
    return (error as ApiClientError).message;
  }
  return "Une erreur est survenue";
}

/**
 * Bulletin local : exactement un choix par poste (candidacyId | "blanc").
 * Miroir Web RadioGroup — aucune sélection par défaut.
 * undefined / absent = pas encore choisi (≠ vote blanc).
 */
export type LocalBallot = Record<string, string | "blanc" | undefined>;

/**
 * État initial bulletin : aucune sélection (comme Web `votes = {}`).
 */
export function createEmptyBallot(): LocalBallot {
  return {};
}

/**
 * Choisir un candidat ou vote blanc pour un poste (choix exclusif).
 */
export function selectBallotChoice(
  ballot: LocalBallot,
  positionId: string,
  value: string | "blanc"
): LocalBallot {
  return { ...ballot, [positionId]: value };
}

/**
 * A-t-on un choix explicite pour ce poste ?
 * Vote blanc compte ; absence de clé / undefined non.
 */
export function hasPositionChoice(
  ballot: LocalBallot,
  positionId: string
): boolean {
  const v = ballot[positionId];
  return v === "blanc" || (typeof v === "string" && v.length > 0);
}

/**
 * Construit le payload votes depuis la sélection locale.
 * Ignore les postes déjà votés.
 * N'envoie jamais un poste sans choix explicite.
 */
export function buildVotePayload(
  selections: LocalBallot,
  alreadyVotedPositionIds: string[]
): Array<{ positionId: string; candidacyId: string | null }> {
  const voted = new Set(alreadyVotedPositionIds);
  const out: Array<{ positionId: string; candidacyId: string | null }> = [];
  for (const [positionId, value] of Object.entries(selections)) {
    if (voted.has(positionId)) continue;
    if (value == null || value === "") continue;
    out.push({
      positionId,
      candidacyId: value === "blanc" ? null : value,
    });
  }
  return out;
}

/**
 * Tous les postes restants ont un choix explicite (candidat ou blanc) ?
 * Miroir Web `isVoteComplete`.
 */
export function isBallotComplete(
  pendingPositionIds: string[],
  selections: LocalBallot
): boolean {
  return pendingPositionIds.every((id) => hasPositionChoice(selections, id));
}

/**
 * Résumé lisible pour confirmation.
 */
export function buildBallotSummary(
  positions: Array<{
    id: string;
    titre: string;
    candidates: Array<{ id: string; displayName: string }>;
  }>,
  selections: LocalBallot
): string {
  return positions
    .map((p) => {
      const v = selections[p.id];
      if (v === "blanc") return `${p.titre} : Vote blanc`;
      if (v) {
        const name =
          p.candidates.find((c) => c.id === v)?.displayName || "Candidat";
        return `${p.titre} : ${name}`;
      }
      return `${p.titre} : non choisi`;
    })
    .join("\n");
}

/**
 * Tone badge candidature pour StatusBadge.
 */
export function candidacyBadgeTone(
  status: string | null
): "warning" | "success" | "danger" | "neutral" {
  switch (status) {
    case "EnAttente":
      return "warning";
    case "Validee":
      return "success";
    case "Rejetee":
      return "danger";
    default:
      return "neutral";
  }
}

/**
 * Afficher CTA « Se porter candidat » ?
 */
export function shouldShowApplyCta(position: MyElectionPositionDto): boolean {
  return position.canApply === true;
}

/**
 * Afficher CTA retrait ?
 */
export function shouldShowWithdrawCta(position: MyElectionPositionDto): boolean {
  return position.canWithdraw === true;
}
