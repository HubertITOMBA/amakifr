"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import type { AuthContext } from "@/lib/auth-context";
import { isServiceError } from "@/lib/service-error";
import {
  createComptePaiement,
  deactivateComptePaiement,
  listComptesPaiement,
  updateComptePaiement,
} from "@/lib/services/payment-accounts/admin-comptes";
import {
  rejectPendingPayment,
  validatePendingPayment,
} from "@/lib/services/paiements/declare-bank-wero-payment";

async function actorFromSession(): Promise<AuthContext | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    userId: session.user.id,
    role: (session.user as { role?: string }).role ?? "MEMBRE",
    status: "Actif",
    email: session.user.email ?? "",
    name: session.user.name ?? null,
    sessionId: null,
    adminRoles: [],
    adherentId: null,
    channel: "web",
  };
}

function actionError(e: unknown): { success: false; error: string } {
  if (isServiceError(e)) {
    return { success: false as const, error: e.message };
  }
  const message =
    e && typeof e === "object" && "message" in e
      ? String((e as { message: string }).message)
      : "Erreur";
  return { success: false as const, error: message };
}

/**
 * Liste les comptes de paiement association (admin).
 */
export async function adminListComptesPaiement() {
  try {
    const actor = await actorFromSession();
    if (!actor) return { success: false as const, error: "Non autorisé" };
    const data = await listComptesPaiement(actor);
    return { success: true as const, data };
  } catch (e: unknown) {
    return actionError(e);
  }
}

/**
 * Crée un compte de paiement.
 */
export async function adminCreateComptePaiement(input: unknown) {
  try {
    const actor = await actorFromSession();
    if (!actor) return { success: false as const, error: "Non autorisé" };
    const data = await createComptePaiement(actor, input);
    revalidatePath("/admin/finances/comptes-paiement");
    revalidatePath("/paiement");
    return { success: true as const, data, message: "Compte créé" };
  } catch (e: unknown) {
    return actionError(e);
  }
}

/**
 * Met à jour un compte de paiement.
 */
export async function adminUpdateComptePaiement(input: unknown) {
  try {
    const actor = await actorFromSession();
    if (!actor) return { success: false as const, error: "Non autorisé" };
    const data = await updateComptePaiement(actor, input);
    revalidatePath("/admin/finances/comptes-paiement");
    revalidatePath("/paiement");
    return { success: true as const, data, message: "Compte mis à jour" };
  } catch (e: unknown) {
    return actionError(e);
  }
}

/**
 * Désactive un compte.
 */
export async function adminDeactivateComptePaiement(id: string) {
  try {
    const actor = await actorFromSession();
    if (!actor) return { success: false as const, error: "Non autorisé" };
    const data = await deactivateComptePaiement(actor, id);
    revalidatePath("/admin/finances/comptes-paiement");
    revalidatePath("/paiement");
    return { success: true as const, data, message: "Compte désactivé" };
  } catch (e: unknown) {
    return actionError(e);
  }
}

/**
 * Valide un paiement EnAttente (ou revalide un Annule).
 */
export async function adminValidatePaiement(paiementId: string) {
  try {
    const actor = await actorFromSession();
    if (!actor) return { success: false as const, error: "Non autorisé" };
    const data = await validatePendingPayment(actor, paiementId);
    revalidatePath("/admin/finances/historique-paiements");
    revalidatePath("/admin/finances/paiements");
    revalidatePath("/user/profile");
    revalidatePath("/paiement");
    return {
      success: true as const,
      data,
      message: "Paiement validé et crédité",
    };
  } catch (e: unknown) {
    return actionError(e);
  }
}

/**
 * Rejette un paiement EnAttente, ou annule un paiement Valide (inverse le crédit).
 */
export async function adminRejectPaiement(paiementId: string) {
  try {
    const actor = await actorFromSession();
    if (!actor) return { success: false as const, error: "Non autorisé" };
    const data = await rejectPendingPayment(actor, paiementId);
    revalidatePath("/admin/finances/historique-paiements");
    revalidatePath("/admin/finances/paiements");
    revalidatePath("/paiement");
    return {
      success: true as const,
      data,
      message: data.reversed
        ? "Paiement annulé — crédits et calculs rétablis"
        : "Paiement rejeté",
    };
  } catch (e: unknown) {
    return actionError(e);
  }
}
