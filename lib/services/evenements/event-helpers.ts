/**
 * Helpers purs métier événements (miroir Web agenda / inscription).
 */

export type EventForRules = {
  statut: string;
  dateAffichage: Date;
  dateFinAffichage: Date;
  dateDebut: Date;
  inscriptionRequis: boolean;
  dateLimiteInscription: Date | null;
  placesDisponibles: number | null;
  placesReservees: number;
};

export type EventTimingStatus = "upcoming" | "ongoing" | "past";

/**
 * Fenêtre d'affichage Web (getAdherentEvenements / getEvenementById public).
 * Distincte de la visibilité self-service mobile (scopes dateDebut).
 */
export function isEventVisibleForAdherent(
  event: Pick<
    EventForRules,
    "statut" | "dateAffichage" | "dateFinAffichage"
  >,
  now = new Date()
): boolean {
  if (event.statut !== "Publie") return false;
  return event.dateAffichage <= now && event.dateFinAffichage >= now;
}

/**
 * Visibilité self-service mobile — source unique liste + détail.
 *
 * Adhérent authentifié : tous les événements `Publie` (publics et privés),
 * comme le filtre statut de getAdherentEvenements, sans exiger dateAffichage
 * pour rester cohérent avec les scopes À venir / Passés (dateDebut/dateFin).
 *
 * Un événement présent dans GET liste doit passer GET détail.
 */
export function canMemberSeeEvent(
  event: { statut: string },
  _now: Date = new Date()
): boolean {
  void _now;
  return event.statut === "Publie";
}

/**
 * Places restantes (null = illimité).
 */
export function computePlacesRestantes(
  placesDisponibles: number | null,
  placesReservees: number
): number | null {
  if (placesDisponibles == null) return null;
  return Math.max(0, placesDisponibles - placesReservees);
}

/**
 * Inscription encore ouverte — miroir UI Web isInscriptionOuverte +
 * backend inscrireEvenement (pas de gate dateAffichage côté Web).
 */
export function isEventRegistrationOpen(
  event: EventForRules,
  now = new Date()
): boolean {
  if (event.statut !== "Publie") return false;
  if (!event.inscriptionRequis) return false;
  if (event.dateLimiteInscription && event.dateLimiteInscription < now) {
    return false;
  }
  const restantes = computePlacesRestantes(
    event.placesDisponibles,
    event.placesReservees
  );
  if (restantes !== null && restantes <= 0) return false;
  return true;
}

/**
 * Peut s'inscrire (ouvert + pas déjà inscrit).
 * Indépendant de obligatoireParticipation (flag absentéisme admin).
 */
export function canRegisterToEvent(
  event: EventForRules,
  estInscrit: boolean,
  now = new Date()
): boolean {
  if (estInscrit) return false;
  return isEventRegistrationOpen(event, now);
}

/**
 * Peut se désinscrire — miroir Web annulerInscriptionEvenement
 * (ownership + inscription existante, pas de fenêtre d'affichage).
 */
export function canWithdrawFromEvent(
  event: Pick<EventForRules, "statut">,
  estInscrit: boolean,
  _now = new Date()
): boolean {
  void _now;
  if (!estInscrit) return false;
  return event.statut === "Publie";
}

/**
 * Classification temporelle — uniquement dateDebut / dateFin (jamais createdAt).
 *
 * - À venir : dateDebut > now
 * - En cours : dateDebut <= now ET dateFin != null ET dateFin >= now
 * - Terminé : dateFin < now, OU dateFin null et dateDebut <= now
 */
export function classifyEventTiming(
  dateDebut: Date,
  dateFin: Date | null,
  now = new Date()
): EventTimingStatus {
  if (dateDebut > now) return "upcoming";
  if (dateFin != null && dateFin >= now) return "ongoing";
  return "past";
}

/**
 * Libellé statut affichage adhérent (texte complet, jamais tronqué côté helper).
 */
export function eventStatusLabel(
  event: {
    statut: string;
    dateDebut: Date;
    dateFin: Date | null;
  },
  now = new Date()
): "À venir" | "En cours" | "Terminé" | "Archivé" | "Brouillon" {
  if (event.statut === "Archive") return "Archivé";
  if (event.statut === "Brouillon") return "Brouillon";
  const timing = classifyEventTiming(event.dateDebut, event.dateFin, now);
  if (timing === "upcoming") return "À venir";
  if (timing === "ongoing") return "En cours";
  return "Terminé";
}

/**
 * Tone pastel pour badges (texte reste source de vérité).
 */
export function eventStatusTone(
  label: string
): "primary" | "success" | "neutral" | "warning" {
  if (label === "À venir") return "primary";
  if (label === "En cours") return "success";
  if (label === "Terminé" || label === "Archivé") return "neutral";
  return "warning";
}

/**
 * Filtre Prisma scope liste — dates métier uniquement (pas createdAt, pas dateAffichage).
 *
 * upcoming = À venir OU En cours
 * past = Terminé
 */
export function buildEventScopeWhere(scope: "upcoming" | "past", now: Date) {
  const base = { statut: "Publie" as const };
  if (scope === "past") {
    return {
      ...base,
      OR: [
        { dateFin: { lt: now } },
        { AND: [{ dateFin: null }, { dateDebut: { lte: now } }] },
      ],
    };
  }
  return {
    ...base,
    OR: [
      { dateDebut: { gt: now } },
      {
        AND: [{ dateDebut: { lte: now } }, { dateFin: { gte: now } }],
      },
    ],
  };
}

/**
 * Parse pagination (max 50).
 */
export function parseEventPagination(
  limitRaw: string | null,
  offsetRaw: string | null
): { limit: number; offset: number } {
  const limit = Math.min(
    50,
    Math.max(1, Number.parseInt(limitRaw ?? "20", 10) || 20)
  );
  const offset = Math.max(0, Number.parseInt(offsetRaw ?? "0", 10) || 0);
  return { limit, offset };
}
