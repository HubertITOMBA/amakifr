/**
 * Helpers admin — synthèse participants et agrégats financiers par événement.
 * Purs / sans I/O : testables et réutilisables côté action + UI.
 */

export type InscriptionParticipantKind = "Adherent" | "Visiteur";

export type AdminInscriptionStatsInput = {
  adherentId?: string | null;
  nombrePersonnes: number;
  montantAttendu?: number | string | null;
  montantPaye?: number | string | null;
};

export type EventParticipationSummary = {
  inscriptionsAdherents: number;
  inscriptionsVisiteurs: number;
  totalInscriptions: number;
  personnesAdherents: number;
  personnesVisiteurs: number;
  totalPersonnes: number;
};

export type EventFinancialSummary = {
  montantAttenduTotal: number;
  montantPayeTotal: number;
  montantRestantTotal: number;
  montantEnAttenteValidation: number;
  isPayant: boolean;
};

/**
 * Type participant : adhérent si adherentId renseigné, sinon visiteur.
 * Ne pas déduire via nom/email.
 */
export function resolveInscriptionParticipantKind(
  adherentId: string | null | undefined
): InscriptionParticipantKind {
  return adherentId != null && adherentId !== "" ? "Adherent" : "Visiteur";
}

/**
 * Libellé FR du type participant.
 */
export function inscriptionParticipantKindLabel(
  kind: InscriptionParticipantKind
): string {
  return kind === "Adherent" ? "Adhérent" : "Visiteur";
}

/**
 * Synthèse inscriptions vs personnes (distinct).
 * Ex. 1 adhérent pour 3 personnes → 1 inscription adhérent, 3 personnes.
 */
export function computeEventParticipationSummary(
  inscriptions: AdminInscriptionStatsInput[]
): EventParticipationSummary {
  let inscriptionsAdherents = 0;
  let inscriptionsVisiteurs = 0;
  let personnesAdherents = 0;
  let personnesVisiteurs = 0;

  for (const insc of inscriptions) {
    const n = Math.max(0, Math.floor(Number(insc.nombrePersonnes) || 0));
    if (resolveInscriptionParticipantKind(insc.adherentId) === "Adherent") {
      inscriptionsAdherents += 1;
      personnesAdherents += n;
    } else {
      inscriptionsVisiteurs += 1;
      personnesVisiteurs += n;
    }
  }

  return {
    inscriptionsAdherents,
    inscriptionsVisiteurs,
    totalInscriptions: inscriptionsAdherents + inscriptionsVisiteurs,
    personnesAdherents,
    personnesVisiteurs,
    totalPersonnes: personnesAdherents + personnesVisiteurs,
  };
}

function toMoneyNumber(value: number | string | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Agrégats financiers d'un événement (inscriptions de CET événement uniquement).
 * montantEnAttenteValidation est fourni séparément (SUM paiements EnAttente).
 */
export function computeEventFinancialSummary(params: {
  inscriptions: AdminInscriptionStatsInput[];
  montantEnAttenteValidation?: number | string | null;
}): EventFinancialSummary {
  let montantAttenduTotal = 0;
  let montantPayeTotal = 0;
  let montantRestantTotal = 0;

  for (const insc of params.inscriptions) {
    const attendu = toMoneyNumber(insc.montantAttendu);
    const paye = toMoneyNumber(insc.montantPaye);
    montantAttenduTotal += attendu;
    montantPayeTotal += paye;
    montantRestantTotal += Math.max(0, attendu - paye);
  }

  const montantEnAttenteValidation = toMoneyNumber(
    params.montantEnAttenteValidation
  );

  return {
    montantAttenduTotal,
    montantPayeTotal,
    montantRestantTotal,
    montantEnAttenteValidation,
    isPayant: montantAttenduTotal > 0,
  };
}

/**
 * Domaine d'un paiement admin : événement si inscriptionEvenementId / relation présente.
 */
export function resolvePaymentDomaine(paiement: {
  inscriptionEvenementId?: string | null;
  InscriptionEvenement?: unknown | null;
}): "evenements" | "cotisations" {
  if (
    paiement.inscriptionEvenementId != null &&
    paiement.inscriptionEvenementId !== ""
  ) {
    return "evenements";
  }
  if (paiement.InscriptionEvenement) {
    return "evenements";
  }
  return "cotisations";
}

/**
 * Filtre domaine Cotisations / Événements.
 */
export function matchesPaymentDomaineFilter(
  paiement: {
    inscriptionEvenementId?: string | null;
    InscriptionEvenement?: unknown | null;
  },
  domaine: "all" | "cotisations" | "evenements"
): boolean {
  if (domaine === "all") return true;
  return resolvePaymentDomaine(paiement) === domaine;
}

/**
 * Type personne d'un paiement historique admin.
 * Cotisations → toujours Adhérent.
 * Événements → adherentId de l'inscription (jamais nom/email).
 */
export function resolvePaymentPersonKind(paiement: {
  inscriptionEvenementId?: string | null;
  InscriptionEvenement?: {
    adherentId?: string | null;
  } | null;
}): InscriptionParticipantKind {
  if (resolvePaymentDomaine(paiement) === "cotisations") {
    return "Adherent";
  }
  return resolveInscriptionParticipantKind(
    paiement.InscriptionEvenement?.adherentId
  );
}

export type PaymentPersonTypeFilter = "all" | "adherents" | "visiteurs";

/**
 * Filtre Type Adhérents / Visiteurs.
 * Domaine Cotisations : Type ignoré (filtre masqué / reset côté UI).
 */
export function matchesPaymentPersonTypeFilter(
  paiement: {
    inscriptionEvenementId?: string | null;
    InscriptionEvenement?: {
      adherentId?: string | null;
    } | null;
  },
  typeFilter: PaymentPersonTypeFilter,
  domaine: "all" | "cotisations" | "evenements" = "all"
): boolean {
  // Domaine cotisations : filtre Type masqué — ne pas appliquer Visiteurs
  if (domaine === "cotisations") {
    return true;
  }
  if (typeFilter === "all") return true;
  const kind = resolvePaymentPersonKind(paiement);
  if (typeFilter === "adherents") return kind === "Adherent";
  return kind === "Visiteur";
}

/**
 * Afficher le Select Type ? Masqué si Domaine = Cotisations.
 */
export function shouldShowPaymentPersonTypeFilter(
  domaine: "all" | "cotisations" | "evenements"
): boolean {
  return domaine !== "cotisations";
}

/**
 * Reset Type quand passage à Cotisations (évite état Visiteurs incohérent).
 */
export function normalizePersonTypeFilterForDomaine(
  domaine: "all" | "cotisations" | "evenements",
  typeFilter: PaymentPersonTypeFilter
): PaymentPersonTypeFilter {
  if (domaine === "cotisations") return "all";
  return typeFilter;
}

/**
 * Libellé destination événement (tous statuts).
 */
export function eventPaymentDestinationLabel(
  titre: string | null | undefined
): string {
  const t = titre?.trim();
  return t ? `Événement — ${t}` : "Événement";
}
