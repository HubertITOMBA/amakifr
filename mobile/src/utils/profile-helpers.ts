/**
 * Helpers purs pour l'écran Profil (initiales, adresse, date).
 */

import type { MeAddressDto } from "@/api/types";

/**
 * Extrait les initiales d'un utilisateur à partir de son nom, prénom+nom, ou email.
 *
 * @param name - Nom complet (peut être null)
 * @param email - Email de repli (peut être null)
 * @returns 1 ou 2 lettres majuscules, ou "?" si aucune info
 */
export function getInitials(
  name: string | null | undefined,
  email?: string | null
): string {
  const trimmed = (name ?? "").trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  const emailTrimmed = (email ?? "").trim();
  if (emailTrimmed) {
    const local = emailTrimmed.split("@")[0];
    if (local && local.length > 0) {
      return local[0].toUpperCase();
    }
  }
  return "?";
}

/**
 * Formate une adresse en lignes lisibles pour un humain.
 * Ne renvoie que les parties non vides.
 *
 * @param address - DTO adresse depuis /api/v1/me
 * @returns Tableau de lignes (ex: ["12 rue X", "75000 Paris", "France"])
 */
export function formatAddress(address: MeAddressDto): string[] {
  const lines: string[] = [];

  const streetParts: string[] = [];
  if (address.streetnum?.trim()) streetParts.push(address.streetnum.trim());
  if (address.street1?.trim()) streetParts.push(address.street1.trim());
  if (streetParts.length > 0) lines.push(streetParts.join(" "));

  if (address.street2?.trim()) lines.push(address.street2.trim());

  const cityParts: string[] = [];
  if (address.codepost?.trim()) cityParts.push(address.codepost.trim());
  if (address.city?.trim()) cityParts.push(address.city.trim());
  if (cityParts.length > 0) lines.push(cityParts.join(" "));

  if (address.country?.trim()) lines.push(address.country.trim());

  return lines;
}

/**
 * Formate une date ISO en français lisible (ex: "15 juin 2025").
 *
 * @param iso - Date ISO string
 * @returns Date formatée ou "—" si invalide
 */
export function formatDateFr(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
  } catch {
    return "—";
  }
}
