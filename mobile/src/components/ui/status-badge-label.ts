/**
 * Affichage badge : espaces insécables pour éviter le wrap Android
 * (« À venir » → ligne « À » seule si largeur contrainte dans une row flex).
 */
export function badgeDisplayLabel(label: string): string {
  return label.replace(/ /g, "\u00A0");
}
