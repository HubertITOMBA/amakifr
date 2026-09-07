import type { AuthContext } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";

/**
 * Champs minimaux pour la fenêtre de candidature.
 */
export type ElectionCandidacyWindow = {
  status: string;
  dateOuverture: Date | string;
  dateClotureCandidature: Date | string;
};

/**
 * Éligibilité candidat — miroir Web (`createCandidacy`) :
 * adhérent + (adresse complète OU téléphone).
 * Fonction distincte de canMemberVote (même règle aujourd'hui, évolutive).
 */
export async function canMemberBeCandidate(
  adherentId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const adherent = await db.adherent.findUnique({
    where: { id: adherentId },
    include: {
      Adresse: true,
      Telephones: true,
    },
  });
  if (!adherent) {
    return { allowed: false, reason: "Profil adhérent non trouvé" };
  }
  const hasAddress =
    adherent.Adresse.length > 0 &&
    adherent.Adresse.some(
      (addr) => addr.street1 && addr.city && addr.codepost
    );
  const hasPhone =
    adherent.Telephones.length > 0 &&
    adherent.Telephones.some((tel) => tel.numero && tel.numero.trim() !== "");

  if (!hasAddress && !hasPhone) {
    return {
      allowed: false,
      reason:
        "Vous devez compléter vos informations personnelles (adresse ou téléphone) dans votre profil avant de pouvoir postuler à un poste.",
    };
  }
  return { allowed: true };
}

/**
 * Fenêtre réelle des candidatures (règle unique Web + mobile).
 *
 * Web : status Ouverte + now <= dateClotureCandidature.
 * Renforcé : now >= dateOuverture (début processus).
 * dateScrutin n'autorise PAS une nouvelle candidature.
 */
export function isElectionCandidacyOpen(
  election: ElectionCandidacyWindow,
  now: Date = new Date()
): boolean {
  if (election.status !== "Ouverte") {
    return false;
  }
  const start = new Date(election.dateOuverture).getTime();
  const end = new Date(election.dateClotureCandidature).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return false;
  }
  const t = now.getTime();
  return t >= start && t <= end;
}

/**
 * Paramètres pour autoriser le retrait d'une candidature.
 * Règle unique Web + mobile.
 */
export type CanWithdrawCandidacyParams = {
  electionStatus: string;
  myCandidacyStatus: string | null;
  /** Début du scrutin — retrait interdit dès now >= dateScrutin. */
  dateScrutin: Date | string;
  /** True si au moins un Vote référence cette candidature. */
  hasVotesOnCandidacy: boolean;
  now?: Date;
};

/**
 * Message métier si le retrait est interdit ; null si autorisé.
 */
export function getCandidacyWithdrawalBlockReason(
  params: CanWithdrawCandidacyParams
): string | null {
  if (params.electionStatus !== "Ouverte") {
    return "L'élection n'est plus ouverte aux modifications";
  }
  if (!params.myCandidacyStatus) {
    return "Candidature introuvable";
  }
  if (params.myCandidacyStatus === "Retiree") {
    return "Cette candidature est déjà retirée";
  }
  if (params.hasVotesOnCandidacy) {
    return "Impossible de retirer cette candidature : des votes ont déjà été enregistrés";
  }
  const scrutin = new Date(params.dateScrutin).getTime();
  if (Number.isNaN(scrutin)) {
    return "Impossible de retirer cette candidature";
  }
  const now = (params.now ?? new Date()).getTime();
  if (now >= scrutin) {
    return "Impossible de retirer cette candidature : le scrutin a commencé";
  }
  return null;
}

/**
 * Retrait autorisé uniquement si :
 * - élection Ouverte
 * - candidature self existante (pas Retiree)
 * - now < dateScrutin
 * - aucun Vote ne référence la candidature
 *
 * Indépendant du statut EnAttente / Validee (comme l'ancien Web).
 */
export function canWithdrawCandidacy(
  params: CanWithdrawCandidacyParams
): boolean {
  return getCandidacyWithdrawalBlockReason(params) === null;
}

/**
 * Libellé statut candidature pour UI.
 */
export function candidacyStatusLabel(status: string): string {
  switch (status) {
    case "EnAttente":
      return "Candidature en attente";
    case "Validee":
      return "Candidature validée";
    case "Rejetee":
      return "Candidature rejetée";
    case "Retiree":
      return "Candidature retirée";
    default:
      return status;
  }
}

/**
 * Champs minimaux pour évaluer la fenêtre de vote.
 */
export type ElectionVotingWindow = {
  status: string;
  /** Début réel du vote (chronologie : après clôture candidatures). */
  dateScrutin: Date | string;
  /** Fin du vote. */
  dateCloture: Date | string;
};

/**
 * Résout l'adhérent self-service (anti-IDOR).
 */
export async function resolveSelfAdherentId(actor: AuthContext): Promise<string> {
  if (!actor?.userId || String(actor.userId).trim() === "") {
    throw new ServiceError("UNAUTHENTICATED", "Non autorisé");
  }
  const adherent = await db.adherent.findUnique({
    where: { userId: actor.userId },
    select: { id: true },
  });
  if (!adherent) {
    throw new ServiceError("NOT_FOUND", "Adhérent introuvable");
  }
  return adherent.id;
}

/**
 * Éligibilité électeur — miroir Web (`vote()` actions/elections) :
 * adhérent + (adresse complète OU téléphone).
 * Pas de contrôle cotisation (absent du Web).
 */
export async function canMemberVote(
  adherentId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const adherent = await db.adherent.findUnique({
    where: { id: adherentId },
    include: {
      Adresse: true,
      Telephones: true,
    },
  });
  if (!adherent) {
    return { allowed: false, reason: "Profil adhérent non trouvé" };
  }
  const hasAddress =
    adherent.Adresse.length > 0 &&
    adherent.Adresse.some(
      (addr) => addr.street1 && addr.city && addr.codepost
    );
  const hasPhone =
    adherent.Telephones.length > 0 &&
    adherent.Telephones.some((tel) => tel.numero && tel.numero.trim() !== "");

  if (!hasAddress && !hasPhone) {
    return {
      allowed: false,
      reason:
        "Vous devez compléter vos informations personnelles (adresse ou téléphone) dans votre profil avant de pouvoir voter.",
    };
  }
  return { allowed: true };
}

/**
 * Fenêtre réelle du vote (règle unique Web + mobile).
 *
 * Chronologie métier validée côté admin :
 * dateOuverture < dateClotureCandidature < dateScrutin < dateCloture
 *
 * - dateOuverture : ouverture du processus (candidatures), pas le début du vote
 * - dateScrutin : début réel du vote
 * - dateCloture : fin du vote
 *
 * Conditions : status === Ouverte ET now ∈ [dateScrutin, dateCloture].
 */
export function isElectionVotingOpen(
  election: ElectionVotingWindow,
  now: Date = new Date()
): boolean {
  if (election.status !== "Ouverte") {
    return false;
  }
  const start = new Date(election.dateScrutin).getTime();
  const end = new Date(election.dateCloture).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return false;
  }
  const t = now.getTime();
  return t >= start && t <= end;
}

/**
 * Phase UX relative à la fenêtre de vote.
 */
export function electionVotingPhase(
  election: ElectionVotingWindow,
  now: Date = new Date()
): "before" | "open" | "after" | "other" {
  if (election.status === "Preparation") return "before";
  if (election.status === "Cloturee") return "after";
  if (election.status !== "Ouverte") return "other";
  if (isElectionVotingOpen(election, now)) return "open";
  const t = now.getTime();
  const start = new Date(election.dateScrutin).getTime();
  if (t < start) return "before";
  return "after";
}

/**
 * Libellé statut élection pour UI (statut DB).
 */
export function electionStatusLabel(status: string): string {
  switch (status) {
    case "Preparation":
      return "À venir";
    case "Ouverte":
      return "Ouverte";
    case "Cloturee":
      return "Clôturée";
    case "Annulee":
      return "Annulée";
    default:
      return status;
  }
}

/**
 * Scope liste mobile (tient compte de la fenêtre temporelle).
 */
export function electionListScope(
  election: ElectionVotingWindow,
  now: Date = new Date()
): "open" | "upcoming" | "closed" {
  const phase = electionVotingPhase(election, now);
  if (phase === "open") return "open";
  if (phase === "before") return "upcoming";
  return "closed";
}

/**
 * État personnel pour une élection (DTO liste / détail).
 */
export function memberElectionState(params: {
  status: string;
  dateScrutin: Date | string;
  dateCloture: Date | string;
  eligible: boolean;
  votedPositionIds: string[];
  positionIds: string[];
  now?: Date;
}): {
  canVote: boolean;
  hasVoted: boolean;
  resultsAvailable: boolean;
  personalLabel: string;
  votingOpen: boolean;
} {
  const now = params.now ?? new Date();
  const window: ElectionVotingWindow = {
    status: params.status,
    dateScrutin: params.dateScrutin,
    dateCloture: params.dateCloture,
  };
  const votingOpen = isElectionVotingOpen(window, now);
  const phase = electionVotingPhase(window, now);
  const resultsAvailable = params.status === "Cloturee";
  const hasVoted =
    params.positionIds.length > 0 &&
    params.positionIds.every((id) => params.votedPositionIds.includes(id));
  const hasPartial =
    params.votedPositionIds.length > 0 && !hasVoted;
  const canVote =
    votingOpen &&
    params.eligible &&
    params.positionIds.some((id) => !params.votedPositionIds.includes(id));

  let personalLabel = "—";
  if (params.status === "Annulee") {
    personalLabel = "Annulée";
  } else if (!params.eligible && votingOpen) {
    personalLabel = "Non éligible";
  } else if (phase === "before") {
    personalLabel = "À venir";
  } else if (params.status === "Cloturee") {
    personalLabel = hasVoted || hasPartial ? "Terminée — voté" : "Terminée";
  } else if (phase === "after") {
    // status encore Ouverte mais dateCloture dépassée
    personalLabel =
      hasVoted || hasPartial ? "Vote fermé — voté" : "Vote fermé";
  } else if (hasVoted) {
    personalLabel = "Vote enregistré";
  } else if (hasPartial) {
    personalLabel = "Vote partiel — à compléter";
  } else if (canVote) {
    personalLabel = "À voter";
  }

  return { canVote, hasVoted, resultsAvailable, personalLabel, votingOpen };
}
