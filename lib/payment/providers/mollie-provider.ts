/**
 * Provider Mollie pour les paiements en ligne
 * Utilise @mollie/api-client (package officiel)
 */

import createMollieClient from "@mollie/api-client";
import type { PaymentProviderInterface, PaymentSessionOptions, PaymentSessionResult } from "./types";

export class MollieProvider implements PaymentProviderInterface {
  private mollie: ReturnType<typeof createMollieClient>;

  constructor(apiKey?: string) {
    if (!apiKey) {
      throw new Error("MOLLIE_API_KEY est requis pour utiliser le provider Mollie");
    }
    this.mollie = createMollieClient({ apiKey });
  }

  async createCheckoutSession(options: PaymentSessionOptions): Promise<PaymentSessionResult> {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:9050";
      const payment = await this.mollie.payments.create({
        amount: {
          value: options.montant.toFixed(2),
          currency: "EUR",
        },
        description: options.description || "Paiement AMAKI France",
        redirectUrl: `${baseUrl}/paiement/success?payment_id={id}`,
        webhookUrl: `${baseUrl}/api/webhooks/mollie`,
        metadata: {
          adherentId: options.adherentId,
          userId: options.userId,
          type: options.type,
          itemId: options.itemId || "",
          ...options.metadata,
        },
      });

      const checkoutUrl = payment.getCheckoutUrl();
      if (!checkoutUrl) {
        return {
          success: false,
          error: "Mollie n'a pas renvoyé d'URL de paiement",
        };
      }

      return {
        success: true,
        sessionId: payment.id,
        url: checkoutUrl,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erreur lors de la création du paiement Mollie";
      console.error("MOLLIE_ERROR", error);
      return {
        success: false,
        error: message,
      };
    }
  }

  async verifyWebhook(_body: string, _signature: string): Promise<unknown> {
    // Mollie envoie une requête GET avec ?id=tr_xxx ; la vérification se fait dans la route API
    // en récupérant le paiement côté Mollie. Pas de signature à vérifier comme Stripe.
    return null;
  }
}
