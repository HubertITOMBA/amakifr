/**
 * Helpers métier réunions mensuelles (lieu, dates, éligibilité participation).
 * Alignés sur le Web `/reunions-mensuelles` et `confirmerParticipationReunion`.
 */

export type HostTelephoneDto = {
  numero: string;
  type: string;
};

export type AdresseLike = {
  label?: string | null;
  streetnum?: string | null;
  street1?: string | null;
  street2?: string | null;
  codepost?: string | null;
  city?: string | null;
  country?: string | null;
};

/**
 * Indique si la date de réunion est passée (comparaison au début de journée locale).
 */
export function isReunionPast(
  dateReunion: Date | null | undefined,
  now: Date = new Date()
): boolean {
  if (!dateReunion) return false;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const d = new Date(dateReunion);
  if (Number.isNaN(d.getTime())) return false;
  d.setHours(0, 0, 0, 0);
  return d.getTime() < startOfToday.getTime();
}

/**
 * Participation modifiable uniquement si date confirmée et réunion non passée
 * (aligné Web : dialog participation ouvert seulement pour DateConfirmee future).
 */
export function canUpdateParticipation(input: {
  statut: string;
  dateReunion: Date | null;
}): boolean {
  if (input.statut !== "DateConfirmee") return false;
  if (!input.dateReunion) return false;
  return !isReunionPast(input.dateReunion);
}

/**
 * Libellé compact pour carte fermée (sans adresse complète).
 */
export function buildLieuLabel(input: {
  typeLieu: string;
  adresse: string | null;
  nomRestaurant: string | null;
  hostFirstname: string | null;
  hostLastname: string | null;
}): string | null {
  if (input.typeLieu === "Domicile") {
    const name = [input.hostFirstname, input.hostLastname]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (!name) return "Hôte à désigner";
    return `Chez ${name}`;
  }

  if (input.typeLieu === "Restaurant") {
    const name = input.nomRestaurant?.trim();
    return name ? `Restaurant ${name}` : "Restaurant";
  }

  const addr = input.adresse?.trim();
  if (!addr) return "Lieu à confirmer";
  if (addr.length <= 40) return addr;
  return `${addr.slice(0, 37)}…`;
}

/**
 * Patch Prisma des champs lieu au désistement hôte.
 *
 * - Domicile : lié à l'identité de l'hôte → `adresse` nullifiée en base
 *   (évite PII domicile orpheline ; le Web ne le faisait pas, mais le métier
 *   domicile = chez l'hôte l'exige).
 * - Restaurant / Autre : lieu indépendant de l'hôte → conservé
 *   (aligné `desisterReunionMensuelle` qui ne touche pas ces champs ;
 *   test mobile « sans hôte → adresse Autre conservée »).
 * - typeLieu / nomRestaurant : inchangés.
 */
export function hostWithdrawalLocationPatch(typeLieu: string): {
  adresse?: null;
} {
  if (typeLieu === "Domicile") {
    return { adresse: null };
  }
  return {};
}

/**
 * Formate une adresse adhérent en une ligne lisible.
 */
export function formatAdresseLieu(adresse: AdresseLike): string | null {
  if (adresse.label?.trim()) return adresse.label.trim();

  const parts: string[] = [];
  const street = [adresse.streetnum, adresse.street1]
    .filter((p): p is string => !!p && p.trim().length > 0)
    .join(" ")
    .trim();
  if (street) parts.push(street);
  if (adresse.street2?.trim()) parts.push(adresse.street2.trim());

  const cityLine = [adresse.codepost, adresse.city]
    .filter((p): p is string => !!p && p.trim().length > 0)
    .join(" ")
    .trim();
  if (cityLine) parts.push(cityLine);
  if (adresse.country?.trim()) parts.push(adresse.country.trim());

  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * Adresse complète du lieu de réunion (carte dépliée, réunions actives/futures).
 * Fallback domicile hôte uniquement si `allowHostFallback` (DateConfirmee).
 * Sans hôte + Domicile : jamais d'adresse (défense contre PII orpheline).
 */
export function buildLieuAdresse(input: {
  typeLieu: string;
  adresse: string | null;
  hostAdresse: AdresseLike | null;
  allowHostFallback?: boolean;
  /** false après désistement / sans hôte */
  hasHost?: boolean;
}): string | null {
  if (input.typeLieu === "Domicile") {
    if (input.hasHost === false) return null;
    if (input.adresse?.trim()) return input.adresse.trim();
    if (input.allowHostFallback !== false && input.hostAdresse) {
      return formatAdresseLieu(input.hostAdresse);
    }
    return null;
  }

  return input.adresse?.trim() || null;
}

/**
 * Expose adresse / téléphone hôte pour les réunions opérationnelles.
 * Masque uniquement l'historique DateConfirmee passée et les annulées.
 * Ne masque PAS une DateConfirmee future.
 */
export function shouldExposeOperationalCoords(input: {
  statut: string;
  dateReunion: Date | null;
  now?: Date;
}): boolean {
  if (input.statut === "Annulee") return false;
  if (
    input.statut === "DateConfirmee" &&
    isReunionPast(input.dateReunion, input.now)
  ) {
    return false;
  }
  return true;
}

/**
 * Résout lieuAdresse pour le DTO :
 * - passée / annulée → null
 * - DateConfirmee → adresse réunion ou fallback domicile hôte
 * - EnAttente / MoisValide → uniquement si adresse réellement définie (pas de fallback hôte)
 * - Domicile sans hôte → null (jamais l'adresse de l'ancien hôte)
 */
export function resolveLieuAdresseForDto(input: {
  statut: string;
  typeLieu: string;
  adresse: string | null;
  hostAdresse: AdresseLike | null;
  dateReunion: Date | null;
  now?: Date;
  hasHost?: boolean;
}): string | null {
  if (
    !shouldExposeOperationalCoords({
      statut: input.statut,
      dateReunion: input.dateReunion,
      now: input.now,
    })
  ) {
    return null;
  }

  const dateConfirmed = input.statut === "DateConfirmee";
  return buildLieuAdresse({
    typeLieu: input.typeLieu,
    adresse: input.adresse,
    hostAdresse: input.hostAdresse,
    allowHostFallback: dateConfirmed,
    hasHost: input.hasHost,
  });
}

/**
 * Sélectionne les téléphones utiles pour joindre l'hôte (sans email).
 * Priorité : principal, puis mobile, puis les autres.
 */
export function selectHostTelephones(
  telephones: Array<{
    numero: string;
    type: string;
    estPrincipal: boolean;
  }>
): HostTelephoneDto[] {
  if (telephones.length === 0) return [];

  const sorted = [...telephones].sort((a, b) => {
    if (a.estPrincipal !== b.estPrincipal) {
      return a.estPrincipal ? -1 : 1;
    }
    const score = (t: { type: string }) => {
      if (t.type === "Mobile") return 0;
      if (t.type === "Fixe") return 1;
      return 2;
    };
    return score(a) - score(b);
  });

  return sorted.map((t) => ({
    numero: t.numero,
    type: t.type,
  }));
}
