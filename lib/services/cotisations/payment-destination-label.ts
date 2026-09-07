import { buildAssistanceDisplayLabel } from "@/lib/services/cotisations/build-assistance-display-label";

const MOIS_LABELS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
] as const;

const ASSISTANCE_TYPE_LABELS: Record<string, string> = {
  Naissance: "Naissance",
  MariageEnfant: "Mariage d'enfant",
  DecesFamille: "Décès familial",
  AnniversaireSalle: "Anniversaire (salle)",
  Autre: "Autre",
};

export type PaymentDestinationInput = {
  CotisationMensuelle: {
    mois: number;
    annee: number;
    description?: string | null;
    TypeCotisation: {
      nom: string;
      categorie?: string | null;
      aBeneficiaire?: boolean | null;
    };
    AdherentBeneficiaire?: {
      civility?: string | null;
      firstname?: string | null;
      lastname?: string | null;
    } | null;
    CotisationDuMois?: {
      AdherentBeneficiaire?: {
        civility?: string | null;
        firstname?: string | null;
        lastname?: string | null;
      } | null;
    } | null;
  } | null;
  DetteInitiale: { annee: number } | null;
  Assistance: { type: string; description?: string | null } | null;
  ObligationCotisation?: { periode?: string | null } | null;
  InscriptionEvenement?: {
    Evenement?: { titre?: string | null } | null;
  } | null;
  description: string | null;
  detteInitialeId?: string | null;
  cotisationMensuelleId?: string | null;
  assistanceId?: string | null;
  obligationCotisationId?: string | null;
  inscriptionEvenementId?: string | null;
};

/**
 * Indique si une description PaiementCotisation est un journal technique
 * (déclaration / validation / rejet), pas une destination métier.
 */
export function isTechnicalPaymentNote(
  description: string | null | undefined
): boolean {
  const desc = description?.trim() ?? "";
  if (!desc) return false;
  return (
    /^Déclaration\s/i.test(desc) ||
    /\ben attente de validation\b/i.test(desc) ||
    /Validé par l['’]administration/i.test(desc) ||
    /Revalidé par l['’]administration/i.test(desc) ||
    /Annulation admin/i.test(desc) ||
    /Rejeté par l['’]administration/i.test(desc)
  );
}

/**
 * Libellé de destination métier d'un paiement.
 * Ne jamais exposer le journal technique (`description` appendée à la validation)
 * comme destination.
 */
export function buildPaymentDestinationLabel(
  input: PaymentDestinationInput
): string {
  if (input.InscriptionEvenement?.Evenement?.titre?.trim()) {
    return `Événement — ${input.InscriptionEvenement.Evenement.titre.trim()}`;
  }
  if (input.inscriptionEvenementId) {
    return "Événement";
  }
  if (input.CotisationMensuelle) {
    const cm = input.CotisationMensuelle;
    const isAssistanceCategory =
      cm.TypeCotisation.categorie === "Assistance" ||
      cm.TypeCotisation.aBeneficiaire === true;

    if (isAssistanceCategory) {
      const benef =
        cm.AdherentBeneficiaire ??
        cm.CotisationDuMois?.AdherentBeneficiaire ??
        null;
      return buildAssistanceDisplayLabel({
        typeNom: cm.TypeCotisation.nom,
        description: cm.description,
        beneficiaire: benef,
      });
    }

    const moisLabel = MOIS_LABELS[cm.mois - 1] ?? String(cm.mois);
    const nom = cm.TypeCotisation.nom.trim();
    return `${nom} — ${moisLabel} ${cm.annee}`;
  }
  if (input.DetteInitiale) {
    return `Dette antérieure ${input.DetteInitiale.annee}`;
  }
  if (input.detteInitialeId) {
    return "Dette antérieure";
  }
  if (input.Assistance) {
    const label =
      ASSISTANCE_TYPE_LABELS[input.Assistance.type] ?? input.Assistance.type;
    const detail = input.Assistance.description?.trim();
    if (detail) {
      return `Assistance ${label} — ${detail}`;
    }
    return `Assistance — ${label}`;
  }
  if (input.assistanceId) {
    return "Assistance";
  }
  if (input.ObligationCotisation) {
    const periode = input.ObligationCotisation.periode?.trim();
    return periode
      ? `Obligation de cotisation (${periode})`
      : "Obligation de cotisation";
  }
  if (input.obligationCotisationId) {
    return "Obligation de cotisation";
  }
  if (input.cotisationMensuelleId) {
    return "Cotisation";
  }
  const desc = input.description?.trim();
  if (desc && !isTechnicalPaymentNote(desc)) {
    return desc;
  }
  return "Paiement";
}

/**
 * Visibilité colonnes admin historique selon filtre Domaine.
 * Cotisations : pas de colonne Événement vide.
 * Événements : colonne Événement, pas Destination redondante.
 * Tous : Domaine + Destination générique.
 */
export function adminHistoriqueColumnVisibilityForDomaine(
  domaine: "all" | "cotisations" | "evenements"
): Record<string, boolean> {
  return {
    objetPaye: false,
    description: false,
    typePersonne: domaine === "evenements",
    evenement: domaine === "evenements",
    domaine: domaine === "all",
    destination: domaine !== "evenements",
  };
}
