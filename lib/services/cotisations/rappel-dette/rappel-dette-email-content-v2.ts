import {
  buildRappelDetteDetailAbsoluteUrlV2,
  type ResolveAppBaseUrlOptions,
} from "@/lib/services/cotisations/rappel-dette/canonical-app-url";

/**
 * Contenu neutre template `email-rappel-dette-v2`.
 * Dette nette = montant calculé à une date de référence ;
 * le lien mène à la **situation actuelle** du compte (pouvant différer).
 *
 * Module **non branché** aux actions / UI / cron d’envoi.
 * Lien construit **uniquement** via la base serveur + path catalogue v2
 * (aucun override d’URL libre).
 */

export type BuildRappelDetteEmailContentV2Input = {
  /** Dette nette calculée (2 décimales, EUR) — chiffre unique. */
  detteNetteFormatted: string;
  /** Jour civil Europe/Paris de référence, ex. `30/06/2024` ou `2024-06-30`. */
  referenceDateLabel: string;
  /** Civilité + prénom déjà résolus serveur (pas de PII bancaire). */
  salutationName?: string | null;
  /** Options de résolution de la base serveur (tests / injection). */
  resolveAppUrlOptions?: ResolveAppBaseUrlOptions;
};

export type RappelDetteEmailContentV2 = {
  subject: string;
  html: string;
  detailAbsoluteUrl: string;
  templateVersion: "email-rappel-dette-v2";
};

/**
 * Construit sujet + HTML neutres pour le template v2.
 *
 * @param input - Montant à la date de calcul + label de date
 * @returns Contenu, ou null si l’URL détail serveur est indisponible / invalide
 */
export function buildRappelDetteEmailContentV2(
  input: BuildRappelDetteEmailContentV2Input
): RappelDetteEmailContentV2 | null {
  const detailAbsoluteUrl = buildRappelDetteDetailAbsoluteUrlV2(
    input.resolveAppUrlOptions
  );
  if (!detailAbsoluteUrl) return null;

  const name = (input.salutationName ?? "").trim();
  const hello = name ? `Bonjour ${name},` : "Bonjour,";

  const subject =
    "AMAKI — Information relative à votre situation de cotisation";

  const html = `<!DOCTYPE html><html lang="fr"><body style="font-family:sans-serif;color:#111;line-height:1.5">
<p>${escapeHtml(hello)}</p>
<p>À la date du <strong>${escapeHtml(input.referenceDateLabel)}</strong>, le montant net de cotisation restant calculé pour votre situation s’élève à <strong>${escapeHtml(input.detteNetteFormatted)}&nbsp;€</strong>.</p>
<p>Ce montant correspond à la situation <strong>calculée à cette date</strong>. En vous connectant, vous consultez la <strong>situation actuelle</strong> de votre compte, qui peut avoir évolué (paiement, avoir, nouvelle cotisation, etc.).</p>
<p><a href="${escapeHtmlAttr(detailAbsoluteUrl)}">Consulter le détail dans votre espace adhérent</a></p>
<p>Cordialement,<br/>L’association AMAKI</p>
</body></html>`;

  return {
    subject,
    html,
    detailAbsoluteUrl,
    templateVersion: "email-rappel-dette-v2",
  };
}

/**
 * Échappe le texte HTML (champs dynamiques).
 *
 * @param value - Texte brut
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Échappe une valeur pour attribut HTML (ex. href).
 *
 * @param value - Texte brut
 */
export function escapeHtmlAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
