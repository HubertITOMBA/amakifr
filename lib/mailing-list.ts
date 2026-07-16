/**
 * Utilitaires pour les courriers postaux (mailing list adhérents)
 */

import type { Civilities } from "@prisma/client";

export type MailingListRecipient = {
  adherentId: string;
  civilite: string;
  prenom: string;
  nom: string;
  nomComplet: string;
  adresseLigne1: string;
  adresseLigne2?: string;
  codePostal: string;
  ville: string;
  email?: string;
};

export const MAILING_LIST_PLACEHOLDERS = [
  { key: "{{civilite}}", label: "Civilité" },
  { key: "{{prenom}}", label: "Prénom" },
  { key: "{{nom}}", label: "Nom" },
  { key: "{{nomComplet}}", label: "Prénom + nom" },
  { key: "{{adresse}}", label: "Adresse (ligne 1)" },
  { key: "{{adresseLigne2}}", label: "Adresse (ligne 2)" },
  { key: "{{codePostal}}", label: "Code postal" },
  { key: "{{ville}}", label: "Ville" },
] as const;

/**
 * Formate la civilité pour un courrier postal
 */
export function formatMailingCivility(civility?: Civilities | null): string {
  if (!civility) return "";
  return civility;
}

/**
 * Construit les lignes d'adresse postale à partir d'une adresse adhérent
 */
export function buildPostalAddressLines(adr: {
  label?: string | null;
  streetnum?: string | null;
  street1?: string | null;
  street2?: string | null;
  street?: string | null;
  codepost?: string | null;
  postcode?: string | null;
  city?: string | null;
} | null | undefined): { ligne1: string; ligne2?: string; codePostal: string; ville: string } {
  if (!adr) {
    return { ligne1: "", codePostal: "", ville: "" };
  }

  const ligne1 =
    adr.label?.trim() ||
    [adr.streetnum, adr.street1 || adr.street].filter(Boolean).join(" ").trim() ||
    adr.street1?.trim() ||
    "";

  return {
    ligne1,
    ligne2: adr.street2?.trim() || undefined,
    codePostal: (adr.codepost || adr.postcode || "").trim(),
    ville: (adr.city || "").trim(),
  };
}

/**
 * Remplace les variables de personnalisation dans un texte
 */
export function mergeMailingTemplate(text: string, recipient: MailingListRecipient): string {
  const replacements: Record<string, string> = {
    "{{civilite}}": recipient.civilite,
    "{{prenom}}": recipient.prenom,
    "{{nom}}": recipient.nom,
    "{{nomComplet}}": recipient.nomComplet,
    "{{adresse}}": recipient.adresseLigne1,
    "{{adresseLigne2}}": recipient.adresseLigne2 || "",
    "{{codePostal}}": recipient.codePostal,
    "{{ville}}": recipient.ville,
  };

  let result = text;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.split(key).join(value);
  }
  return result;
}

/**
 * Découpe un texte multiligne en paragraphes (séparateur double saut de ligne)
 */
export function splitMailingBodyParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}
