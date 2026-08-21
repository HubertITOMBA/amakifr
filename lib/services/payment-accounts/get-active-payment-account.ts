import { db } from "@/lib/db";
import type { AuthContext } from "@/lib/auth-context";
import { ServiceError } from "@/lib/service-error";
import type { ActivePaymentAccountDto } from "@/lib/services/payment-accounts/types";
import { mapActivePaymentAccountDto } from "@/lib/services/payment-accounts/map-compte";

/**
 * Compte de paiement actif présenté aux adhérents (self-service).
 * Ownership : lecture publique authentifiée, pas de sélection d'id client.
 *
 * @returns le compte actif ou null si aucun
 */
export async function getActiveAssociationPaymentAccount(
  actor: AuthContext
): Promise<ActivePaymentAccountDto | null> {
  if (!actor?.userId || String(actor.userId).trim() === "") {
    throw new ServiceError("UNAUTHENTICATED", "Non autorisé");
  }

  const row = await db.comptePaiementAssociation.findFirst({
    where: { actifPourPaiement: true },
  });

  if (!row) return null;
  return mapActivePaymentAccountDto(row);
}
