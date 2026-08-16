/**
 * Formatage monétaire à partir d'une string décimale API.
 * Ne passe jamais par Number / parseFloat (précision).
 */

const MONEY_RE = /^-?\d+(\.\d+)?$/;

/**
 * Formate une string décimale pour affichage FR.
 * Ex. "25.5" → "25,50 €". Si > 2 décimales, préserve (pas d'arrondi Number).
 * Valeur invalide → "—".
 *
 * @param value - String décimale (ex. "25", "25.5", "0")
 */
export function formatMoneyDecimalString(value: string): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw || !MONEY_RE.test(raw)) {
    return "—";
  }

  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [intPartRaw, fracRaw = ""] = unsigned.split(".");

  // Pad à 2 décimales si moins ; préserver si plus (DB Decimal(10,2) mais toString peut tronquer les zéros)
  let frac = fracRaw;
  if (frac.length < 2) {
    frac = frac.padEnd(2, "0");
  }

  const intPart = intPartRaw.replace(/^0+(?=\d)/, "") || "0";
  const sign = negative ? "-" : "";
  return `${sign}${intPart},${frac} €`;
}
