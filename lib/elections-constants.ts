import { PositionType } from "@prisma/client";
import { getAllPostesTemplates } from "@/actions/postes";

// Constantes pour les 8 types de postes (rétrocompatibilité)
export const POSTES_ELECTORAUX = {
  PRESIDENT: PositionType.President,
  VICE_PRESIDENT: PositionType.VicePresident,
  SECRETAIRE: PositionType.Secretaire,
  VICE_SECRETAIRE: PositionType.ViceSecretaire,
  TRESORIER: PositionType.Tresorier,
  VICE_TRESORIER: PositionType.ViceTresorier,
  COMMISSAIRE_COMPTES: PositionType.CommissaireComptes,
  MEMBRE_COMITE_DIRECTEUR: PositionType.MembreComiteDirecteur,
} as const;

// Labels français pour les postes (rétrocompatibilité)
export const POSTES_LABELS = {
  [PositionType.President]: "Président",
  [PositionType.VicePresident]: "Vice-Président",
  [PositionType.Secretaire]: "Secrétaire",
  [PositionType.ViceSecretaire]: "Vice-Secrétaire",
  [PositionType.Tresorier]: "Trésorier",
  [PositionType.ViceTresorier]: "Vice-Trésorier",
  [PositionType.CommissaireComptes]: "Commissaire aux comptes",
  [PositionType.MembreComiteDirecteur]: "Membre du comité directeur",
} as const;

// Fonction pour obtenir le label d'un poste (compatible avec l'ancien système)
export function getPosteLabel(type: PositionType | string): string {
  if (Object.values(PositionType).includes(type as PositionType)) {
    return POSTES_LABELS[type as PositionType] || type;
  }
  return type;
}

// Fonction pour obtenir tous les postes disponibles (depuis la base de données)
export async function getAllPostesFromDB() {
  try {
    const result = await getAllPostesTemplates(true); // Seulement les actifs
    if (result.success && result.data) {
      return result.data.map((poste: any) => ({
        id: poste.id,
        code: poste.code,
        libelle: poste.libelle,
        description: poste.description,
        ordre: poste.ordre,
        actif: poste.actif,
        nombreMandatsDefaut: poste.nombreMandatsDefaut,
        dureeMandatDefaut: poste.dureeMandatDefaut,
      }));
    }
    // Fallback vers l'ancien système si erreur
    return Object.entries(POSTES_LABELS).map(([type, libelle]) => ({
      type,
      libelle,
    }));
  } catch (error) {
    console.error("Erreur lors de la récupération des postes:", error);
    // Fallback vers l'ancien système
    return Object.entries(POSTES_LABELS).map(([type, libelle]) => ({
      type,
      libelle,
    }));
  }
}

// Fonction pour obtenir tous les postes disponibles (version synchrone - rétrocompatibilité)
export function getAllPostes() {
  return Object.entries(POSTES_LABELS);
}

// Fonction pour vérifier si un poste est valide
export function isValidPoste(type: string): type is PositionType {
  return Object.values(PositionType).includes(type as PositionType);
}

// Mapping code -> PositionType pour la compatibilité (codes de 6 caractères)
export const CODE_TO_POSITION_TYPE: Record<string, PositionType> = {
  // Nouveaux codes (6 caractères)
  'PRESID': PositionType.President,
  'VICEPR': PositionType.VicePresident,
  'SECRET': PositionType.Secretaire,
  'VICESE': PositionType.ViceSecretaire,
  'TRESOR': PositionType.Tresorier,
  'VICETR': PositionType.ViceTresorier,
  'COMCPT': PositionType.CommissaireComptes,
  'MEMCDI': PositionType.MembreComiteDirecteur,
  // Anciens codes (pour rétrocompatibilité avec données existantes)
  'president': PositionType.President,
  'vice_president': PositionType.VicePresident,
  'secretaire': PositionType.Secretaire,
  'vice_secretaire': PositionType.ViceSecretaire,
  'tresorier': PositionType.Tresorier,
  'vice_tresorier': PositionType.ViceTresorier,
  'commissaire_comptes': PositionType.CommissaireComptes,
  'membre_comite_directeur': PositionType.MembreComiteDirecteur,
};

// Mapping PositionType -> code (nouveaux codes de 6 caractères)
export const POSITION_TYPE_TO_CODE: Record<PositionType, string> = {
  [PositionType.President]: 'PRESID',
  [PositionType.VicePresident]: 'VICEPR',
  [PositionType.Secretaire]: 'SECRET',
  [PositionType.ViceSecretaire]: 'VICESE',
  [PositionType.Tresorier]: 'TRESOR',
  [PositionType.ViceTresorier]: 'VICETR',
  [PositionType.CommissaireComptes]: 'COMCPT',
  [PositionType.MembreComiteDirecteur]: 'MEMCDI',
};
