import type { ComptePaiementAssociation } from "@prisma/client";
import type {
  ActivePaymentAccountDto,
  ComptePaiementAssociationDto,
} from "@/lib/services/payment-accounts/types";

/**
 * Mappe un compte Prisma vers DTO admin.
 */
export function mapComptePaiementDto(
  row: ComptePaiementAssociation
): ComptePaiementAssociationDto {
  return {
    id: row.id,
    libelle: row.libelle,
    titulaire: row.titulaire,
    iban: row.iban,
    bic: row.bic,
    codeBanque: row.codeBanque,
    codeGuichet: row.codeGuichet,
    numeroCompte: row.numeroCompte,
    cleRib: row.cleRib,
    telephoneWero: row.telephoneWero,
    weroActif: row.weroActif,
    actifPourPaiement: row.actifPourPaiement,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Mappe le compte actif vers DTO self-service (sans id admin).
 */
export function mapActivePaymentAccountDto(
  row: ComptePaiementAssociation
): ActivePaymentAccountDto {
  return {
    libelle: row.libelle,
    titulaire: row.titulaire,
    iban: row.iban,
    bic: row.bic,
    codeBanque: row.codeBanque,
    codeGuichet: row.codeGuichet,
    numeroCompte: row.numeroCompte,
    cleRib: row.cleRib,
    telephoneWero: row.weroActif ? row.telephoneWero : null,
    weroActif: row.weroActif && !!row.telephoneWero,
  };
}
