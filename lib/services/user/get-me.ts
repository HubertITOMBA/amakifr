import { db } from "@/lib/db";
import type { AuthContext } from "@/lib/auth-context";
import { ServiceError } from "@/lib/service-error";
import type { MeDto } from "@/lib/services/user/types";

/**
 * Retourne le profil minimal de l'utilisateur authentifié (self-service).
 *
 * Précondition : `actor` a déjà été résolu par la couche d'authentification
 * (Server Action via session, ou future API via Bearer).
 * Pour getMe, `adminRoles` / `adherentId` peuvent être vides : seule `userId` est requise.
 * Ne pas réutiliser un AuthContext « minimal getMe » comme resolver générique
 * pour d'autres opérations protégées.
 *
 * Aucun effet de bord. N'utilise pas auth()/cookies/HTTP.
 *
 * @param actor - Identité authentifiée
 * @returns MeDto sérialisable (sans password, tokens, providerAccountId)
 * @throws {ServiceError} UNAUTHENTICATED | NOT_FOUND | INTERNAL_ERROR
 */
export async function getMe(actor: AuthContext): Promise<MeDto> {
  if (!actor?.userId) {
    throw new ServiceError("UNAUTHENTICATED", "Identité manquante");
  }

  try {
    const user = await db.user.findUnique({
      where: { id: actor.userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        status: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        adherent: {
          select: {
            id: true,
            civility: true,
            firstname: true,
            lastname: true,
            departement_id: true,
            sous_departement_id: true,
            created_at: true,
            updated_at: true,
            Adresse: {
              select: {
                id: true,
                streetnum: true,
                street1: true,
                street2: true,
                codepost: true,
                city: true,
                country: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
        accounts: {
          select: {
            id: true,
            type: true,
            provider: true,
          },
        },
      },
    });

    if (!user) {
      throw new ServiceError("NOT_FOUND", "Utilisateur introuvable");
    }

    const adherent = user.adherent;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      status: user.status,
      lastLogin: user.lastLogin?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      adherentId: adherent?.id ?? null,
      adherent: adherent
        ? {
            id: adherent.id,
            civility: adherent.civility,
            firstname: adherent.firstname,
            lastname: adherent.lastname,
            departement_id: adherent.departement_id,
            sous_departement_id: adherent.sous_departement_id,
            created_at: adherent.created_at?.toISOString() ?? null,
            updated_at: adherent.updated_at?.toISOString() ?? null,
            addresses: adherent.Adresse.map((address) => ({
              id: address.id,
              streetnum: address.streetnum,
              street1: address.street1,
              street2: address.street2,
              codepost: address.codepost,
              city: address.city,
              country: address.country,
              createdAt: address.createdAt.toISOString(),
              updatedAt: address.updatedAt.toISOString(),
            })),
          }
        : null,
      accounts: user.accounts.map((account) => ({
        id: account.id,
        type: account.type,
        provider: account.provider,
      })),
    };
  } catch (error) {
    if (error instanceof ServiceError) {
      throw error;
    }
    console.error("[getMe] Erreur:", error);
    throw new ServiceError("INTERNAL_ERROR", "Erreur lors de la récupération du profil");
  }
}
