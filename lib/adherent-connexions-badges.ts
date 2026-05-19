/**
 * Paliers de badges liés au nombre de connexions au portail
 */
export const CONNEXION_BADGE_TIERS = [
  { nom: "Première visite", minConnexions: 1, couleur: "slate" },
  { nom: "Explorateur", minConnexions: 5, couleur: "blue" },
  { nom: "Habitué", minConnexions: 15, couleur: "green" },
  { nom: "Ambassadeur", minConnexions: 30, couleur: "purple" },
  { nom: "Champion du portail", minConnexions: 50, couleur: "gold" },
] as const;

/**
 * Retourne le palier de badge correspondant au nombre de connexions
 *
 * @param loginCount - Nombre de connexions de l'adhérent
 * @returns Le palier atteint ou null si aucune connexion
 */
export function getConnexionBadgeTier(loginCount: number) {
  if (loginCount <= 0) return null;
  let tier: (typeof CONNEXION_BADGE_TIERS)[number] | null = null;
  for (const t of CONNEXION_BADGE_TIERS) {
    if (loginCount >= t.minConnexions) tier = t;
  }
  return tier;
}

/**
 * Indique si un badge est un badge de connexion (condition JSON)
 */
export function isConnexionBadgeCondition(condition: string | null | undefined): boolean {
  if (!condition) return false;
  try {
    const parsed = JSON.parse(condition) as { type?: string };
    return parsed.type === "nombre_connexions";
  } catch {
    return false;
  }
}
