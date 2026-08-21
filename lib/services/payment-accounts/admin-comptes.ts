import { db } from "@/lib/db";
import type { AuthContext } from "@/lib/auth-context";
import { ServiceError } from "@/lib/service-error";
import { authorize } from "@/lib/authorize";
import {
  CreateComptePaiementSchema,
  UpdateComptePaiementSchema,
  formatComptePaiementZodError,
  normalizePhoneFr,
  type ComptePaiementAssociationDto,
} from "@/lib/services/payment-accounts/types";
import { mapComptePaiementDto } from "@/lib/services/payment-accounts/map-compte";

async function requireFinancesWrite(actor: AuthContext) {
  await authorize({
    actor,
    permissionKey: "createPaiement",
    type: "WRITE",
  });
}

/**
 * Liste tous les comptes de paiement (admin).
 */
export async function listComptesPaiement(
  actor: AuthContext
): Promise<ComptePaiementAssociationDto[]> {
  await requireFinancesWrite(actor);
  const rows = await db.comptePaiementAssociation.findMany({
    orderBy: [{ actifPourPaiement: "desc" }, { updatedAt: "desc" }],
  });
  return rows.map(mapComptePaiementDto);
}

/**
 * Crée un compte. Si actifPourPaiement, désactive les autres en transaction.
 */
export async function createComptePaiement(
  actor: AuthContext,
  input: unknown
): Promise<ComptePaiementAssociationDto> {
  await requireFinancesWrite(actor);
  if (!actor.userId) {
    throw new ServiceError("UNAUTHENTICATED", "Non autorisé");
  }

  const parsed = CreateComptePaiementSchema.safeParse(input);
  if (!parsed.success) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      formatComptePaiementZodError(parsed.error)
    );
  }
  const data = parsed.data;

  const created = await db.$transaction(async (tx) => {
    if (data.actifPourPaiement) {
      await tx.comptePaiementAssociation.updateMany({
        where: { actifPourPaiement: true },
        data: { actifPourPaiement: false },
      });
    }
    return tx.comptePaiementAssociation.create({
      data: {
        libelle: data.libelle,
        titulaire: data.titulaire,
        iban: data.iban,
        bic: data.bic,
        codeBanque: data.codeBanque,
        codeGuichet: data.codeGuichet,
        numeroCompte: data.numeroCompte,
        cleRib: data.cleRib,
        telephoneWero: data.telephoneWero,
        weroActif: data.weroActif,
        actifPourPaiement: data.actifPourPaiement,
        createdBy: actor.userId,
      },
    });
  });

  return mapComptePaiementDto(created);
}

/**
 * Met à jour un compte. Activation exclusive si actifPourPaiement=true.
 */
export async function updateComptePaiement(
  actor: AuthContext,
  input: unknown
): Promise<ComptePaiementAssociationDto> {
  await requireFinancesWrite(actor);

  const parsed = UpdateComptePaiementSchema.safeParse(input);
  if (!parsed.success) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      formatComptePaiementZodError(parsed.error)
    );
  }
  const { id, ...rest } = parsed.data;

  const existing = await db.comptePaiementAssociation.findUnique({
    where: { id },
  });
  if (!existing) {
    throw new ServiceError("NOT_FOUND", "Compte introuvable");
  }

  const merged = {
    libelle: rest.libelle ?? existing.libelle,
    titulaire: rest.titulaire ?? existing.titulaire,
    iban: rest.iban ?? existing.iban,
    bic: rest.bic ?? existing.bic,
    codeBanque:
      rest.codeBanque !== undefined ? rest.codeBanque : existing.codeBanque,
    codeGuichet:
      rest.codeGuichet !== undefined ? rest.codeGuichet : existing.codeGuichet,
    numeroCompte:
      rest.numeroCompte !== undefined
        ? rest.numeroCompte
        : existing.numeroCompte,
    cleRib: rest.cleRib !== undefined ? rest.cleRib : existing.cleRib,
    telephoneWero:
      rest.telephoneWero !== undefined
        ? rest.telephoneWero && String(rest.telephoneWero).trim()
          ? normalizePhoneFr(String(rest.telephoneWero))
          : null
        : existing.telephoneWero,
    weroActif: rest.weroActif ?? existing.weroActif,
    actifPourPaiement: rest.actifPourPaiement ?? existing.actifPourPaiement,
  };

  if (merged.weroActif && !merged.telephoneWero) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      "Le téléphone Wero est obligatoire si Wero est activé"
    );
  }

  const updated = await db.$transaction(async (tx) => {
    if (merged.actifPourPaiement) {
      await tx.comptePaiementAssociation.updateMany({
        where: { actifPourPaiement: true, NOT: { id } },
        data: { actifPourPaiement: false },
      });
    }
    return tx.comptePaiementAssociation.update({
      where: { id },
      data: merged,
    });
  });

  return mapComptePaiementDto(updated);
}

/**
 * Désactive un compte (actifPourPaiement=false, weroActif=false).
 */
export async function deactivateComptePaiement(
  actor: AuthContext,
  id: string
): Promise<ComptePaiementAssociationDto> {
  await requireFinancesWrite(actor);
  const existing = await db.comptePaiementAssociation.findUnique({
    where: { id },
  });
  if (!existing) {
    throw new ServiceError("NOT_FOUND", "Compte introuvable");
  }
  const updated = await db.comptePaiementAssociation.update({
    where: { id },
    data: { actifPourPaiement: false, weroActif: false },
  });
  return mapComptePaiementDto(updated);
}
