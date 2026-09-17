/**
 * Arithmétique monétaire client (centimes entiers) — sans Prisma / Decimal.
 * Format accepté : `12`, `12.3`, `12.34`, éventuellement virgule `12,34`.
 */

const MONEY_RE = /^-?\d+(?:[.,]\d{1,2})?$/;

/**
 * Parse une chaîne monétaire en centimes entiers.
 *
 * @param raw - Montant texte ou nombre entier/décimal raisonnable
 * @returns Centimes (ex. "10.01" → 1001)
 */
export function parseMoneyToCents(raw: string | number): number {
  const s = String(raw ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(",", ".");
  if (!s || !MONEY_RE.test(s)) {
    throw new Error("Montant monétaire invalide");
  }
  const neg = s.startsWith("-");
  const body = neg ? s.slice(1) : s;
  const [wholePart, fracPart = ""] = body.split(".");
  const whole = Number(wholePart);
  if (!Number.isInteger(whole) || whole < 0) {
    throw new Error("Montant monétaire invalide");
  }
  const frac = (fracPart + "00").slice(0, 2);
  const cents = whole * 100 + Number(frac);
  return neg ? -cents : cents;
}

/**
 * Formate des centimes en chaîne à 2 décimales.
 *
 * @param cents - Centimes entiers
 */
export function centsToMoneyString(cents: number): string {
  if (!Number.isInteger(cents)) {
    throw new Error("Centimes invalides");
  }
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${neg ? "-" : ""}${whole}.${frac}`;
}

/**
 * Soustraction monétaire a − b → chaîne.
 */
export function moneySubStrings(
  a: string | number,
  b: string | number
): string {
  return centsToMoneyString(parseMoneyToCents(a) - parseMoneyToCents(b));
}

/**
 * max(0, a − b) en chaîne.
 */
export function moneyRestantNonNegatif(
  a: string | number,
  b: string | number
): string {
  const c = parseMoneyToCents(a) - parseMoneyToCents(b);
  return centsToMoneyString(c < 0 ? 0 : c);
}

/**
 * true si montant > 0.
 */
export function moneyIsStrictlyPositive(raw: string | number): boolean {
  try {
    return parseMoneyToCents(raw) > 0;
  } catch {
    return false;
  }
}
