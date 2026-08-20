import { libelleCivilite } from "@/lib/utils/cotisations";

/**
 * Libellé d'affichage assistance — même règle que le Web (profil / admin paiements).
 *
 * Priorité :
 * 1. `CotisationMensuelle.description` si déjà au format « Type - … »
 * 2. sinon `TypeCotisation.nom - civilité Prénom Nom` (bénéficiaire)
 * 3. sinon description brute ou nom du type
 *
 * @see buildDescriptionLigne dans lib/utils/cotisations.ts
 * @see app/user/profile/page.tsx buildItemsForMonth
 */
export function buildAssistanceDisplayLabel(input: {
  typeNom: string;
  description?: string | null;
  beneficiaire?: {
    civility?: string | null;
    firstname?: string | null;
    lastname?: string | null;
  } | null;
}): string {
  const typeNom = (input.typeNom ?? "").trim() || "Assistance";
  const description =
    typeof input.description === "string" ? input.description.trim() : "";

  if (description.includes(" - ")) {
    return description;
  }

  const benef = input.beneficiaire;
  if (benef) {
    const parts = [
      libelleCivilite(benef.civility),
      benef.firstname,
      benef.lastname,
    ].filter((p) => Boolean(p && String(p).trim()));
    if (parts.length > 0) {
      return `${typeNom} - ${parts.join(" ")}`;
    }
  }

  return description || typeNom;
}
