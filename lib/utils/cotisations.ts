/**
 * Utilitaires pour le calcul des cotisations mensuelles
 * 
 * Cette fonction centralise la logique de calcul pour garantir la cohérence
 * entre la création, la mise à jour et le recalcul des cotisations.
 */

/**
 * Type pour une cotisation du mois avec ses relations
 */
export type CotisationDuMoisWithRelations = {
  id: string;
  periode: string;
  montantBase: number | string;
  adherentBeneficiaireId: string | null;
  TypeCotisation: {
    id: string;
    nom: string;
    aBeneficiaire: boolean;
  };
  AdherentBeneficiaire?: {
    id: string;
    firstname: string;
    lastname: string;
  } | null;
};

/**
 * Résultat du calcul d'une cotisation mensuelle
 */
export interface CalculCotisationResult {
  montantTotal: number;
  description: string;
  details: {
    forfait: {
      nom: string;
      montant: number;
    };
    assistances: Array<{
      nom: string;
      montant: number;
      beneficiaire?: {
        id: string;
        firstname: string;
        lastname: string;
      };
      estBeneficiaire: boolean; // true si l'adhérent est le bénéficiaire de cette assistance
    }>;
    assistancesBeneficiaires: Array<{
      nom: string;
      montant: number;
    }>;
  };
}

/**
 * Calcule le montant total et génère la description détaillée d'une cotisation mensuelle
 * pour un adhérent donné.
 * 
 * Règle simple : 
 * - Le forfait est toujours payé par tous
 * - Chaque assistance est payée par tous SAUF son bénéficiaire
 * 
 * @param adherentId - L'ID de l'adhérent pour lequel calculer la cotisation
 * @param periode - La période au format "YYYY-MM"
 * @param cotisationsDuMois - Toutes les cotisations du mois pour cette période
 * @returns Le résultat du calcul avec montant total et description détaillée
 */
export function calculerCotisationMensuelle(
  adherentId: string,
  periode: string,
  cotisationsDuMois: CotisationDuMoisWithRelations[]
): CalculCotisationResult {
  let montantTotal = 0;
  const details = {
    forfait: {
      nom: "",
      montant: 0,
    },
    assistances: [] as CalculCotisationResult['details']['assistances'],
    assistancesBeneficiaires: [] as CalculCotisationResult['details']['assistancesBeneficiaires'],
  };

  // Parcourir toutes les cotisations du mois
  for (const cdm of cotisationsDuMois) {
    const montant = Number(cdm.montantBase);
    const estAssistance = cdm.TypeCotisation.aBeneficiaire === true;
    const estBeneficiaire = cdm.adherentBeneficiaireId === adherentId;

    if (estAssistance) {
      // C'est une assistance
      if (estBeneficiaire) {
        // L'adhérent est le bénéficiaire : il ne paie pas cette assistance
        details.assistancesBeneficiaires.push({
          nom: cdm.TypeCotisation.nom,
          montant,
        });
      } else {
        // L'adhérent n'est pas le bénéficiaire : il paie cette assistance
        montantTotal += montant;
        details.assistances.push({
          nom: cdm.TypeCotisation.nom,
          montant,
          beneficiaire: cdm.AdherentBeneficiaire || undefined,
          estBeneficiaire: false,
        });
      }
    } else {
      // C'est le forfait : toujours payé par tous
      montantTotal += montant;
      details.forfait = {
        nom: cdm.TypeCotisation.nom,
        montant,
      };
    }
  }

  // Construire la description détaillée
  const descriptionParts: string[] = [];
  
  // Forfait
  if (details.forfait.nom) {
    descriptionParts.push(`${details.forfait.nom} ${details.forfait.montant.toFixed(2)}€`);
  }

  // Assistances bénéficiaires (ne paie pas)
  if (details.assistancesBeneficiaires.length > 0) {
    const beneficiaireDetails = details.assistancesBeneficiaires
      .map(a => `${a.nom} (bénéficiaire - ne paie pas)`)
      .join(", ");
    descriptionParts.push(`Bénéficiaire de: ${beneficiaireDetails}`);
  }

  // Assistances à payer
  if (details.assistances.length > 0) {
    const assistancesDetails = details.assistances.map(a => {
      if (a.beneficiaire) {
        return `${a.nom} pour ${a.beneficiaire.firstname} ${a.beneficiaire.lastname} (${a.montant.toFixed(2)}€)`;
      }
      return `${a.nom} (${a.montant.toFixed(2)}€)`;
    });
    descriptionParts.push(assistancesDetails.join(" + "));
  }

  // Description finale
  const description = `Cotisation ${periode}: ${descriptionParts.join(" + ")} = Total: ${montantTotal.toFixed(2)}€`;

  return {
    montantTotal,
    description,
    details,
  };
}

/**
 * Trouve le forfait parmi les cotisations du mois
 */
export function trouverForfait(
  cotisationsDuMois: CotisationDuMoisWithRelations[]
): CotisationDuMoisWithRelations | null {
  return cotisationsDuMois.find(cdm => !cdm.TypeCotisation.aBeneficiaire) || null;
}

/**
 * Trouve toutes les assistances parmi les cotisations du mois
 */
export function trouverAssistances(
  cotisationsDuMois: CotisationDuMoisWithRelations[]
): CotisationDuMoisWithRelations[] {
  return cotisationsDuMois.filter(cdm => cdm.TypeCotisation.aBeneficiaire === true);
}
