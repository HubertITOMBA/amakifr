import type {
  RappelGlobalReason,
  RappelLineIgnoreReason,
} from "@/lib/services/cotisations/rappel-dette/types";

const GLOBAL_LABELS: Record<RappelGlobalReason, string> = {
  ELIGIBLE: "Éligible au rappel",
  ADHERENT_NOT_FOUND: "Adhérent introuvable",
  USER_INACTIVE: "Compte utilisateur inactif",
  NO_RETAINED_LINES: "Aucune ligne exigible retenue",
  COVERED_BY_AVOIR: "Dette couverte par les avoirs disponibles",
  REMINDER_COOLDOWN_30D: "Rappel déjà envoyé il y a moins de 30 jours",
  FROZEN_CONTESTED: "Dette gelée / contestée",
  PRISMA_ERROR: "Erreur technique de calcul",
};

const LINE_LABELS: Record<RappelLineIgnoreReason, string> = {
  STATUS_CLOSED: "Ligne clôturée (payée / annulée)",
  ZERO_OR_NEGATIVE_REMAINING: "Solde ligne nul ou négatif",
  PENDING_PAYMENT: "Paiement en cours ou justificatif en attente",
  ASSISTANCE_BENEFICIARY: "Adhérent bénéficiaire de l’assistance (non redevable)",
  NOT_YET_DUE_J15: "Échéance non atteinte (avant J+15)",
  FROZEN_CONTESTED: "Ligne gelée / contestée",
  MISSING_DUE_DATE: "Échéance manquante",
};

export type LabeledReason = {
  code: string;
  label: string;
};

/**
 * Traduit un code de motif global (adhérent) en libellé français.
 * Code inconnu → libellé de repli conservant le code.
 *
 * @param code - Code RappelGlobalReason ou inconnu
 */
export function labelGlobalReason(code: string): LabeledReason {
  const known = GLOBAL_LABELS[code as RappelGlobalReason];
  if (known) return { code, label: known };
  return { code, label: `Motif inconnu (${code})` };
}

/**
 * Traduit un code de motif de ligne ignorée en libellé français.
 * Code inconnu → libellé de repli conservant le code.
 *
 * @param code - Code RappelLineIgnoreReason ou inconnu
 */
export function labelLineIgnoreReason(code: string): LabeledReason {
  const known = LINE_LABELS[code as RappelLineIgnoreReason];
  if (known) return { code, label: known };
  return { code, label: `Motif de ligne inconnu (${code})` };
}

/**
 * Motifs globaux considérés comme échec technique (pas exclusion métier).
 */
export const TECHNICAL_GLOBAL_REASONS: ReadonlySet<RappelGlobalReason> = new Set([
  "PRISMA_ERROR",
]);

/**
 * Indique si le résultat Lot 1 est un échec technique de calcul.
 *
 * @param globalReasons - Motifs globaux retournés par computeDetteRappelable
 */
export function isTechnicalComputationFailure(
  globalReasons: readonly string[]
): boolean {
  return globalReasons.some((r) =>
    TECHNICAL_GLOBAL_REASONS.has(r as RappelGlobalReason)
  );
}
