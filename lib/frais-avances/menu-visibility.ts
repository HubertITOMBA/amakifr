/**
 * Liens menus frais avancés — hint UX uniquement (pas d'authz).
 */
import { isNotesFraisEnabledClientHint } from "@/lib/frais-avances/feature-flag-client";

/** Liens seedés (provisionnement explicite uniquement). */
export const FRAIS_AVANCES_SEEDED_MENU_LIENS = [
  "/user/frais-avances",
  "/admin/frais-avances",
  "/admin/frais-avances/comptabilite",
  "/admin/frais-avances/parametres/conservation",
] as const;

/**
 * true si le lien appartient au module frais avancés (y compris sous-routes).
 */
export function isFraisAvancesMenuLien(lien: string): boolean {
  const l = (lien || "").trim();
  if (!l) return false;
  if (l === "/user/frais-avances" || l.startsWith("/user/frais-avances/")) {
    return true;
  }
  if (l === "/admin/frais-avances" || l.startsWith("/admin/frais-avances/")) {
    return true;
  }
  return false;
}

/**
 * Masque les entrées frais avancés lorsque le hint public est off.
 * Ne constitue jamais une autorisation.
 *
 * @param menus - Menus déjà filtrés par rôles
 */
export function filterMenusByNotesFraisPublicHint<T extends { lien: string }>(
  menus: T[]
): T[] {
  if (isNotesFraisEnabledClientHint()) return menus;
  return menus.filter((m) => !isFraisAvancesMenuLien(m.lien));
}
