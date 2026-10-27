/**
 * Helpers d’affichage de la prévisualisation admin (R1 Lot 2).
 * Présentation uniquement — ne modifie pas le DTO ni computeDetteRappelable.
 */

export type PreviewDisplayComputationKind =
  | "eligible"
  | "excluded"
  | "failed";

/** Espace fine insécable (groupes de milliers fr-FR). */
const THIN_NBSP = "\u202f";
/** Espace insécable avant « € ». */
const NBSP = "\u00a0";

/**
 * Incrémente une chaîne de chiffres décimaux non signée (précision arbitraire).
 *
 * @param digits - Chiffres uniquement
 * @returns digits + 1
 */
function addOneDigitString(digits: string): string {
  const chars = digits.split("");
  let carry = 1;
  for (let i = chars.length - 1; i >= 0 && carry; i -= 1) {
    const n = (chars[i]!.charCodeAt(0) - 48) + carry;
    chars[i] = String(n % 10);
    carry = n >= 10 ? 1 : 0;
  }
  return carry ? `1${chars.join("")}` : chars.join("");
}

/**
 * Groupe les chiffres d’une partie entière à la française (milliers).
 *
 * @param integerDigits - Chiffres sans signe
 * @returns Ex. `"7635"` → `"7 635"`
 */
function groupFrenchIntegerDigits(integerDigits: string): string {
  const normalized = integerDigits.replace(/^0+(?=\d)/, "") || "0";
  const parts: string[] = [];
  for (let i = normalized.length; i > 0; i -= 3) {
    parts.unshift(normalized.slice(Math.max(0, i - 3), i));
  }
  return parts.join(THIN_NBSP);
}

type ParsedCents =
  | { ok: false }
  | { ok: true; negative: boolean; centsDigits: string };

/**
 * Parse une chaîne décimale DTO en cents (chiffres), arrondi half-up.
 * Aucun `Number` / `parseFloat` / littéral bigint (cible TS ES2017).
 *
 * @param amount - Chaîne monétaire
 * @returns Cents absolus en chiffres, ou échec de parse
 */
function parseDecimalStringToCentsDigits(amount: string): ParsedCents {
  let s = amount.trim().replace(/\u00a0|\u202f|\s/g, "").replace(",", ".");
  let negative = false;
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }

  if (!/^\d+(\.\d+)?$/.test(s)) {
    return { ok: false };
  }

  const [wholePart, fracPart = ""] = s.split(".");
  const whole = wholePart.replace(/^0+(?=\d)/, "") || "0";

  if (fracPart.length <= 2) {
    const centsDigits = `${whole}${fracPart.padEnd(2, "0")}`.replace(
      /^0+(?=\d)/,
      ""
    ) || "0";
    return { ok: true, negative, centsDigits };
  }

  let centsDigits = `${whole}${fracPart.slice(0, 2)}`.replace(/^0+(?=\d)/, "") || "0";
  if (fracPart.charAt(2) >= "5") {
    centsDigits = addOneDigitString(centsDigits);
  }
  return { ok: true, negative, centsDigits };
}

/**
 * Formate des cents (chiffres) en libellé EUR FR exact.
 *
 * @param negative - Signe
 * @param centsDigits - Cents absolus
 * @returns Ex. `"7 635,00 €"`
 */
function formatCentsDigitsToEuro(
  negative: boolean,
  centsDigits: string
): string {
  const padded = centsDigits.padStart(3, "0");
  const euroDigits = padded.slice(0, -2);
  const centDigits = padded.slice(-2);
  const grouped = groupFrenchIntegerDigits(euroDigits);
  const sign = negative && centsDigits !== "0" ? "-" : "";
  return `${sign}${grouped},${centDigits}${NBSP}€`;
}

/**
 * Formate une chaîne décimale monétaire du DTO en euros FR (2 décimales).
 * Ex. `"240"` → `"240,00 €"`, `"17.6"` → `"17,60 €"`, `"7635"` → `"7 635,00 €"`.
 * Chaîne invalide → `"Non calculé"` (jamais `0,00 €`).
 *
 * Mise en forme exacte par chaînes — pas de `Number(cents)/100`.
 *
 * @param amount - Montant sérialisé (chaîne décimale du DTO)
 * @returns Libellé EUR fr-FR à deux décimales, ou « Non calculé »
 */
export function formatPreviewEuroAmount(amount: string): string {
  const parsed = parseDecimalStringToCentsDigits(amount);
  if (!parsed.ok) {
    return "Non calculé";
  }
  return formatCentsDigitsToEuro(parsed.negative, parsed.centsDigits);
}

/**
 * Affiche un montant de prévisualisation.
 * Pour un calcul non abouti, n’affiche jamais les valeurs de repli (0 €).
 *
 * @param amount - Montant sérialisé (chaîne monétaire)
 * @param computationKind - Classification de la ligne
 * @returns Libellé d’affichage (« Non calculé » ou euros FR)
 */
export function formatPreviewAmountDisplay(
  amount: string,
  computationKind: PreviewDisplayComputationKind
): string {
  if (computationKind === "failed") {
    return "Non calculé";
  }
  return formatPreviewEuroAmount(amount);
}

/**
 * Affiche une échéance de prévisualisation.
 * Pour un calcul non abouti, n’affiche jamais une date trompeuse.
 *
 * @param isoFormattedOrDash - Date déjà formatée FR, ou « — »
 * @param computationKind - Classification de la ligne
 * @returns « Non calculé » si échec technique, sinon la valeur fournie
 */
export function formatPreviewDueDisplay(
  isoFormattedOrDash: string,
  computationKind: PreviewDisplayComputationKind
): string {
  if (computationKind === "failed") {
    return "Non calculé";
  }
  return isoFormattedOrDash;
}

/** Indication courte pour les collisions de libellé (présentation seule). */
export const HOMONYM_DISPLAY_NOTICE =
  "Plusieurs fiches portent ce nom." as const;

/**
 * Détecte les collisions de `displayName` sur un ensemble de lignes preview
 * et attribue des références « Fiche N » déterministes (tri des `adherentId`).
 * Les noms uniques ne reçoivent aucune entrée.
 *
 * Références propres au résultat affiché — pas des numéros métier permanents.
 * Aucune lecture DB : utilise uniquement les champs déjà présents.
 *
 * @param rows - Lignes eligible + excluded + failed du même résultat
 * @returns Map adherentId → « Fiche N » pour les seuls homonymes
 */
export function buildHomonymFicheReferences(
  rows: ReadonlyArray<{ adherentId: string; displayName: string }>
): ReadonlyMap<string, string> {
  const byName = new Map<string, string[]>();
  for (const row of rows) {
    const key = row.displayName.trim().toLowerCase();
    const list = byName.get(key) ?? [];
    list.push(row.adherentId);
    byName.set(key, list);
  }

  const refs = new Map<string, string>();
  for (const ids of byName.values()) {
    const uniqueSorted = [...new Set(ids)].sort((a, b) =>
      a.localeCompare(b)
    );
    if (uniqueSorted.length < 2) {
      continue;
    }
    uniqueSorted.forEach((id, index) => {
      refs.set(id, `Fiche ${index + 1}`);
    });
  }
  return refs;
}
