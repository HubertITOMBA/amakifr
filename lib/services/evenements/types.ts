/**
 * DTOs self-service événements (adhérent).
 * Distinct de ReunionMensuelle.
 */

export type MyEventListItemDto = {
  id: string;
  titre: string;
  description: string;
  categorie: string;
  dateDebut: string;
  dateFin: string | null;
  lieu: string | null;
  statutLabel: string;
  inscriptionRequis: boolean;
  dateLimiteInscription: string | null;
  placesDisponibles: number | null;
  placesReservees: number;
  placesRestantes: number | null;
  estInscrit: boolean;
  canRegister: boolean;
  canWithdraw: boolean;
  /** Flag admin absentéisme — pas d'auto-inscription. */
  obligatoireParticipation: boolean;
  /** Tarif unitaire (string décimale) si > 0. */
  prix: string | null;
};

export type MyEventDetailDto = MyEventListItemDto & {
  contenu: string | null;
  adresse: string | null;
  contactEmail: string | null;
  contactTelephone: string | null;
  imagePrincipale: string | null;
  tags: string[] | null;
  inscriptionId: string | null;
  nombrePersonnes: number | null;
  estPublic: boolean;
  /** Snapshot inscription — strings décimales. */
  montantAttendu: string | null;
  montantPaye: string | null;
  montantRestant: string | null;
  statutPaiement: string | null;
  paymentRequired: boolean;
  hasPendingPayment: boolean;
  canPay: boolean;
  /** Historique paiements de cette inscription (ownership self). */
  paiements: MyEventPaymentDto[];
};

export type MyEventPaymentDto = {
  id: string;
  montant: string;
  moyenPaiement: string;
  statut: string;
  datePaiement: string;
  reference: string | null;
  destinationLabel: string;
};

export type MyEventsListDto = {
  items: MyEventListItemDto[];
  total: number;
  limit: number;
  offset: number;
};

export type MyEventsSummaryDto = {
  upcomingCount: number;
  nextEvent: {
    id: string;
    titre: string;
    dateDebut: string;
    lieu: string | null;
  } | null;
};

export type MyEventInscriptionResultDto = {
  inscriptionId: string;
  nombrePersonnes: number;
  montantAttendu: string;
  statutPaiement: string;
};

export type EventScope = "upcoming" | "past";
