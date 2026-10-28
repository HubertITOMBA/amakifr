import type { Prisma } from "@prisma/client";

/** Fuseau calendaire pour les jours civils J+15 / cooldown 30 j. */
export const RAPPEL_DETTE_TIMEZONE = "Europe/Paris" as const;

/** Jours civils après échéance avant éligibilité (inclusif). */
export const RAPPEL_J_PLUS_DAYS = 15;

/** Fenêtre minimale entre deux rappels (jours civils, inclusif à J+30). */
export const RAPPEL_COOLDOWN_DAYS = 30;

/** Statuts paiement bloquant un rappel sur la ligne liée. */
export const PENDING_PAYMENT_STATUSES = ["EnAttente", "EnCours"] as const;

/**
 * Preuve d’envoi réussi pour RelanceCotisationMensuelle (commentaire schéma Prisma).
 * Valeurs observées / documentées : EnAttente, Envoye, Lu, Repondu.
 * Seuls Envoye | Lu | Repondu + dateEnvoi non null comptent pour le cooldown.
 * EnAttente / statut inconnu / échec non modélisé : ne bloquent jamais.
 *
 * Lot 3.2 : union avec RappelDetteEnvoi (emailStatus=Accepted + emailAcceptedAt).
 * Reserved / Calling / Unknown / DefinitelyNotAccepted / Abandoned : non preuves.
 */
export const RAPPEL_SENT_STATUSES = ["Envoye", "Lu", "Repondu"] as const;

/**
 * Sources de dette rappelable.
 * L’entité Prisma `Assistance` (prestation au bénéficiaire) n’est plus une source
 * depuis la décision métier 2026-10-28 — seules les CM (y compris catégorie
 * assistance dues par des tiers) et DetteInitiale le sont.
 */
export type RappelDebtSource =
  | "cotisation_mensuelle"
  | "dette_initiale";

/**
 * Raisons d’ignorance d’une ligne (audit / preview).
 * FROZEN_CONTESTED : prévu ; aucun champ Prisma fiable en Lot 1 (pas de migration).
 */
export type RappelLineIgnoreReason =
  | "STATUS_CLOSED"
  | "ZERO_OR_NEGATIVE_REMAINING"
  | "PENDING_PAYMENT"
  | "ASSISTANCE_BENEFICIARY"
  | "NOT_YET_DUE_J15"
  | "FROZEN_CONTESTED"
  | "MISSING_DUE_DATE";

export type RappelGlobalReason =
  | "ELIGIBLE"
  | "ADHERENT_NOT_FOUND"
  | "USER_INACTIVE"
  | "NO_RETAINED_LINES"
  | "COVERED_BY_AVOIR"
  | "REMINDER_COOLDOWN_30D"
  | "FROZEN_CONTESTED"
  | "PRISMA_ERROR";

export type RappelRetainedLine = {
  source: RappelDebtSource;
  id: string;
  montantRestant: Prisma.Decimal;
  dueDate: Date;
  daysPastDue: number;
};

export type RappelIgnoredLine = {
  source: RappelDebtSource;
  id: string;
  montantRestant: Prisma.Decimal;
  dueDate: Date | null;
  reason: RappelLineIgnoreReason;
};

export type ComputeDetteRappelableResult = {
  eligible: boolean;
  adherentId: string;
  montantBrut: Prisma.Decimal;
  avoirDisponible: Prisma.Decimal;
  detteNette: Prisma.Decimal;
  retainedLines: RappelRetainedLine[];
  ignoredLines: RappelIgnoredLine[];
  earliestDueDate: Date | null;
  /** Prochaine date civile (Europe/Paris) où un rappel pourrait être envisageable. */
  nextEligibleReminderAt: Date | null;
  /**
   * Dernier envoi réussi connu = max des preuves :
   * - RelanceCotisationMensuelle : statut ∈ RAPPEL_SENT_STATUSES + dateEnvoi ;
   * - RappelDetteEnvoi : emailStatus=Accepted + emailAcceptedAt
   *   (indépendant de notifStatus / closedAt).
   * Absent si aucune preuve fiable.
   */
  lastReminderSentAt: Date | null;
  globalReasons: RappelGlobalReason[];
};

/**
 * Client de lecture compatible transaction interactive Prisma.
 * Fourni par le futur service d’envoi (`prisma.$transaction(async (tx) => …)`).
 * Le singleton applicatif `db` (PrismaClient) est structurellement compatible.
 */
export type ComputeDetteRappelablePrisma = Prisma.TransactionClient;

/**
 * Options serveur internes uniquement.
 * Ne jamais hydrater depuis body/query/headers HTTP client —
 * réservé aux callers serveur (jobs, actions admin, tests).
 */
export type ComputeDetteRappelableOptions = {
  /** Horloge injectable (tests). Défaut : new Date(). */
  now?: Date;
  /**
   * Gel / contestation adhérent (futur modèle).
   * Paramètre interne serveur uniquement — jamais depuis une requête client.
   * Lot 1 : pas de colonne Prisma.
   */
  frozenAdherent?: boolean;
  /**
   * Identifiants de lignes gelées : `${source}:${id}`.
   * Paramètre interne serveur uniquement — jamais depuis une requête client.
   */
  frozenLineKeys?: ReadonlySet<string>;
  /**
   * Client Prisma de lecture (ex. `Prisma.TransactionClient` du futur envoi).
   * Si omis : singleton `db` (comportement actuel preview / appels existants).
   * Si fourni : **toutes** les lectures du calcul l’utilisent ; aucun repli sur `db`.
   * Interne serveur uniquement — jamais depuis body/query/headers HTTP.
   * N’ouvre ni transaction ni verrou : orchestration hors de ce calcul.
   */
  prisma?: ComputeDetteRappelablePrisma;
};

/**
 * Construit la clé de gel pour une ligne.
 *
 * @param source - Source métier
 * @param id - Identifiant de ligne
 */
export function frozenLineKey(source: RappelDebtSource, id: string): string {
  return `${source}:${id}`;
}
