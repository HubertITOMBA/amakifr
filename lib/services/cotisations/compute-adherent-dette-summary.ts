import { Prisma } from "@prisma/client";

const ZERO = new Prisma.Decimal(0);

/** Statuts CM / obligations ouverts — alignés sur getCumulDette historique. */
export const ADHERENT_DETTE_OPEN_STATUSES = [
  "EnAttente",
  "PartiellementPaye",
  "EnRetard",
] as const;

export type MontantRestantRow = {
  montantRestant: Prisma.Decimal | string | number;
};

export type CotisationOuvertePourDette = MontantRestantRow & {
  adherentId: string;
  /** Présent si la ligne CM vise un bénéficiaire (ex. catégorie Assistance). */
  adherentBeneficiaireId?: string | null;
};

export type AdherentDetteSummary = {
  detteBrute: Prisma.Decimal;
  avoirDisponible: Prisma.Decimal;
  detteNette: Prisma.Decimal;
};

function toDecimal(
  value: Prisma.Decimal | string | number | null | undefined
): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) return value;
  return new Prisma.Decimal(value ?? 0);
}

/**
 * Indique si une CM ne doit pas compter comme dette du payeur
 * (bénéficiaire = lui-même) — règle existante listes / rappel.
 */
export function isSelfBeneficiaryCotisation(
  row: Pick<CotisationOuvertePourDette, "adherentId" | "adherentBeneficiaireId">
): boolean {
  return (
    row.adherentBeneficiaireId != null &&
    row.adherentBeneficiaireId === row.adherentId
  );
}

/**
 * Somme des montants restants (Decimal).
 */
export function sumMontantsRestants(rows: MontantRestantRow[]): Prisma.Decimal {
  let total = ZERO;
  for (const row of rows) {
    total = total.plus(toDecimal(row.montantRestant));
  }
  return total;
}

/**
 * Dette nette = max(0, brute − avoirs).
 */
export function computeDetteNette(
  detteBrute: Prisma.Decimal | string | number,
  avoirDisponible: Prisma.Decimal | string | number
): Prisma.Decimal {
  const brute = toDecimal(detteBrute);
  const avoirs = toDecimal(avoirDisponible);
  const raw = brute.minus(avoirs);
  return raw.gt(0) ? raw : ZERO;
}

/**
 * Calcule la synthèse de dette adhérent (compte / getCumulDette).
 *
 * Sources : DetteInitiale + CM ouvertes (hors auto-bénéfice) + Obligations
 * legacy + avoirs Disponibles.
 * **N’inclut pas** l’entité `Assistance` (prestation, pas dette du bénéficiaire).
 * Périmètre plus large que le rappel R1 (qui exclut aussi ObligationCotisation).
 *
 * @param input.dettesInitiales - Lignes dette initiale (montantRestant)
 * @param input.cotisationsOuvertes - CM ouvertes du payeur
 * @param input.obligationsOuvertes - Obligations legacy ouvertes
 * @param input.avoirsDisponibles - Avoirs statut Disponible
 */
export function computeAdherentDetteSummary(input: {
  dettesInitiales: MontantRestantRow[];
  cotisationsOuvertes: CotisationOuvertePourDette[];
  obligationsOuvertes: MontantRestantRow[];
  avoirsDisponibles: MontantRestantRow[];
}): AdherentDetteSummary {
  const cotisationsRetenues = input.cotisationsOuvertes.filter(
    (row) => !isSelfBeneficiaryCotisation(row)
  );

  const detteBrute = sumMontantsRestants(input.dettesInitiales)
    .plus(sumMontantsRestants(cotisationsRetenues))
    .plus(sumMontantsRestants(input.obligationsOuvertes));

  const avoirDisponible = sumMontantsRestants(input.avoirsDisponibles);
  const detteNette = computeDetteNette(detteBrute, avoirDisponible);

  return { detteBrute, avoirDisponible, detteNette };
}
