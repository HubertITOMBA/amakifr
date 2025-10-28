import { PositionType } from "@prisma/client";

// Constantes pour les 8 types de postes
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

// Labels français pour les postes
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

// Fonction pour obtenir le label d'un poste
export function getPosteLabel(type: PositionType): string {
  return POSTES_LABELS[type] || type;
}

// Fonction pour obtenir tous les postes disponibles
export function getAllPostes() {
  return Object.entries(POSTES_LABELS);
}

// Fonction pour vérifier si un poste est valide
export function isValidPoste(type: string): type is PositionType {
  return Object.values(PositionType).includes(type as PositionType);
}
