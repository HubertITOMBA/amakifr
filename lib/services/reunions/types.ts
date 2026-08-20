/**
 * DTOs réunions mensuelles self-service mobile.
 * Aucune PII d'autres participants (email, liste nominative, adresses multiples).
 */

export type MyReunionHostTelephoneDto = {
  numero: string;
  type: string;
};

export type MyReunionDto = {
  id: string;
  /** Libellé affiché, ex. "Réunion de mars 2026" */
  titre: string;
  annee: number;
  mois: number;
  /**
   * Date/heure ISO uniquement si statut DateConfirmee.
   * null sinon — date non certaine côté métier.
   */
  dateReunion: string | null;
  /** StatutReunionMensuelle */
  statut: string;
  /** TypeLieuReunion */
  typeLieu: string;
  /**
   * Lieu compact (carte fermée) :
   * - Domicile → "Chez Prénom Nom" ou "Hôte à désigner"
   * - Restaurant → "Restaurant …"
   * - Autre → libellé court ou "Lieu à confirmer"
   */
  lieuLabel: string | null;
  /**
   * Adresse complète du lieu (carte dépliée).
   * Absente pour l'historique (minimisation des coordonnées passées).
   */
  lieuAdresse: string | null;
  /** L'adhérent connecté est-il l'hôte ? */
  isHost: boolean;
  /** Prénom + nom de l'hôte */
  hostName: string | null;
  /**
   * Téléphones utiles de l'hôte (futures/actives uniquement).
   * Absent si pas d'hôte ou réunion passée.
   */
  hostTelephones: MyReunionHostTelephoneDto[] | null;
  /**
   * Statut de participation de l'adhérent connecté uniquement.
   * null si aucune réponse enregistrée.
   */
  participationStatus: string | null;
  /** true si l'adhérent peut modifier sa participation (DateConfirmee, future) */
  canUpdateParticipation: boolean;
  /** Commentaires publics de la réunion */
  commentaires: string | null;
};

export type UpdateMyReunionParticipationInput = {
  statut: "Present" | "Absent" | "Excuse";
};

export type UpdateMyReunionParticipationResult = {
  statut: string;
};
