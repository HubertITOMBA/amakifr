"use server";

import createMollieClient from "@mollie/api-client";
import { db } from "@/lib/db";

/**
 * Récupère les détails d'un paiement Mollie pour la page success (montant, statut, id du paiement en base).
 */
export async function getMolliePaymentSuccessData(paymentId: string): Promise<{
  success: boolean;
  amount?: number;
  currency?: string;
  paymentStatus?: string;
  paiementId?: string;
  error?: string;
}> {
  try {
    const apiKey = process.env.MOLLIE_API_KEY;
    if (!apiKey) {
      return { success: false, error: "Configuration Mollie manquante" };
    }

    const mollie = createMollieClient({ apiKey });
    const payment = await mollie.payments.get(paymentId);

    const paiement = await db.paiementCotisation.findFirst({
      where: { molliePaymentId: paymentId },
    });

    const amount =
      payment.amount && typeof payment.amount.value === "string"
        ? parseFloat(payment.amount.value)
        : 0;

    return {
      success: true,
      amount,
      currency: payment.amount?.currency || "eur",
      paymentStatus: payment.status,
      paiementId: paiement?.id,
    };
  } catch (error) {
    console.error("getMolliePaymentSuccessData:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur inconnue",
    };
  }
}
