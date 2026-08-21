"use server";

import { auth } from "@/auth";
import { getActiveAssociationPaymentAccount } from "@/lib/services/payment-accounts/get-active-payment-account";
import type { ActivePaymentAccountDto } from "@/lib/services/payment-accounts/types";

/**
 * Compte actif pour affichage adhérent (Web).
 */
export async function getActivePaymentAccountForMe(): Promise<{
  success: boolean;
  account?: ActivePaymentAccountDto | null;
  error?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Non autorisé" };
  }
  try {
    const account = await getActiveAssociationPaymentAccount({
      userId: session.user.id,
      role: (session.user as { role?: string }).role ?? "MEMBRE",
      status: "Actif",
      email: session.user.email ?? "",
      name: session.user.name ?? null,
      sessionId: null,
      adminRoles: [],
      adherentId: null,
      channel: "web",
    });
    return { success: true, account };
  } catch (e: unknown) {
    const message =
      e && typeof e === "object" && "message" in e
        ? String((e as { message: string }).message)
        : "Erreur";
    return { success: false, error: message };
  }
}
