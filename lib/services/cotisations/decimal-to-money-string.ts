import { Prisma } from "@prisma/client";

/**
 * Sérialise un montant Prisma Decimal en string décimale JSON-safe.
 * Utilise Decimal.toString() (ex. 25 → "25", 25.50 → "25.5", 0 → "0").
 * Ne passe pas par Number (précision monétaire).
 *
 * Import public : Prisma.Decimal (@prisma/client), pas @prisma/client/runtime/library.
 *
 * @param value - Decimal Prisma ou valeur convertible
 */
export function decimalToMoneyString(
  value: Prisma.Decimal | string | number
): string {
  if (value instanceof Prisma.Decimal) {
    return value.toString();
  }
  return new Prisma.Decimal(value).toString();
}
