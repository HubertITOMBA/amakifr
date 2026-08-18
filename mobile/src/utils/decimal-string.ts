/**
 * Helpers string décimale API — sans Number / parseFloat.
 */

const DECIMAL_RE = /^-?(\d+)(?:\.(\d+))?$/;

/**
 * true si la string décimale représente zéro (ex. "0", "0.00", "000.000").
 */
export function isZeroDecimalString(value: string): boolean {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return false;
  const m = DECIMAL_RE.exec(raw);
  if (!m) return false;
  const intPart = m[1].replace(/^0+/, "") || "0";
  const fracPart = m[2] ?? "";
  return intPart === "0" && (fracPart === "" || /^0+$/.test(fracPart));
}
