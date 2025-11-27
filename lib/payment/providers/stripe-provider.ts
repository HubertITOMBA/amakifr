/**
 * Provider Stripe pour les paiements en ligne
 */

import Stripe from "stripe";
import type { PaymentProviderInterface, PaymentSessionOptions, PaymentSessionResult } from "./types";

export class StripeProvider implements PaymentProviderInterface {
  private stripe: Stripe;

  constructor(secretKey?: string) {
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY est requis pour utiliser le provider Stripe");
    }
    this.stripe = new Stripe(secretKey, {
      apiVersion: "2024-12-18.acacia",
    });
  }

  async createCheckoutSession(options: PaymentSessionOptions): Promise<PaymentSessionResult> {
    try {
      const checkoutSession = await this.stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "eur",
              product_data: {
                name: options.description || "Paiement AMAKI France",
                description: `Paiement pour ${options.metadata?.adherentName || "adhérent"}`,
              },
              unit_amount: Math.round(options.montant * 100), // Convertir en centimes
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:9050"}/paiement/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:9050"}/paiement/cancel`,
        customer_email: options.customerEmail,
        metadata: {
          adherentId: options.adherentId,
          userId: options.userId,
          type: options.type,
          itemId: options.itemId || "",
          ...options.metadata,
        },
        payment_method_options: {
          card: {
            request_three_d_secure: "automatic",
          },
        },
      });

      return {
        success: true,
        sessionId: checkoutSession.id,
        url: checkoutSession.url || undefined,
      };
    } catch (error: any) {
      console.error("STRIPE_ERROR", error);
      return {
        success: false,
        error: error.message || "Erreur lors de la création de la session Stripe",
      };
    }
  }

  async verifyWebhook(body: string, signature: string): Promise<any> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET est requis");
    }

    try {
      const event = this.stripe.webhooks.constructEvent(body, signature, webhookSecret);
      return event;
    } catch (error: any) {
      console.error("STRIPE_WEBHOOK_ERROR", error);
      throw error;
    }
  }
}

