import { parsePhoneNumberFromString } from "libphonenumber-js";

export type PhoneCountry = "FR" | "BE" | "CH" | "LU" | "DE" | "ES" | "IT" | "GB" | "US" | "CA";

/**
 * Normalise un numéro saisi en format E.164 (ex: +33612345678).
 * Retourne `null` si le numéro ne peut pas être interprété.
 */
export function normalizePhoneE164(raw: string | null | undefined, defaultCountry: PhoneCountry = "FR") {
  const input = (raw ?? "").trim();
  if (!input) return null;

  const parsed = parsePhoneNumberFromString(input, defaultCountry);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number; // E.164
}

/**
 * Formate un numéro en affichage international lisible (ex: +33 6 12 34 56 78).
 * Si parsing impossible, retourne la valeur brute (trim).
 */
export function formatPhoneInternational(raw: string | null | undefined, defaultCountry: PhoneCountry = "FR") {
  const input = (raw ?? "").trim();
  if (!input) return "—";

  const parsed = parsePhoneNumberFromString(input, defaultCountry);
  if (!parsed || !parsed.isValid()) return input;

  return parsed.formatInternational();
}

