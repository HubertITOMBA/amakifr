/**
 * Provider PayPal pour les paiements en ligne
 */

import type { PaymentProviderInterface, PaymentSessionOptions, PaymentSessionResult } from "./types";

export class PayPalProvider implements PaymentProviderInterface {
  private clientId: string;
  private clientSecret: string;
  private mode: 'sandbox' | 'live';
  private baseUrl: string;

  constructor(clientId?: string, clientSecret?: string, mode: 'sandbox' | 'live' = 'sandbox') {
    if (!clientId || !clientSecret) {
      throw new Error("PAYPAL_CLIENT_ID et PAYPAL_CLIENT_SECRET sont requis pour utiliser le provider PayPal");
    }
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.mode = mode;
    this.baseUrl = mode === 'live' 
      ? 'https://api-m.paypal.com' 
      : 'https://api-m.sandbox.paypal.com';
  }

  private async getAccessToken(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'en_US',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error("Erreur lors de l'obtention du token d'accès PayPal");
    }

    const data = await response.json();
    return data.access_token;
  }

  async createCheckoutSession(options: PaymentSessionOptions): Promise<PaymentSessionResult> {
    try {
      const accessToken = await this.getAccessToken();

      // Créer une commande PayPal
      const orderResponse = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [
            {
              amount: {
                currency_code: 'EUR',
                value: options.montant.toFixed(2),
              },
              description: options.description || "Paiement AMAKI France",
              custom_id: options.adherentId,
            },
          ],
          application_context: {
            brand_name: 'AMAKI France',
            landing_page: 'NO_PREFERENCE',
            user_action: 'PAY_NOW',
            return_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:9050"}/paiement/success`,
            cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:9050"}/paiement/cancel`,
          },
        }),
      });

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json();
        throw new Error(errorData.message || "Erreur lors de la création de la commande PayPal");
      }

      const orderData = await orderResponse.json();
      
      // Trouver le lien d'approbation
      const approveLink = orderData.links?.find((link: any) => link.rel === 'approve');

      return {
        success: true,
        sessionId: orderData.id,
        url: approveLink?.href,
      };
    } catch (error: any) {
      console.error("PAYPAL_ERROR", error);
      return {
        success: false,
        error: error.message || "Erreur lors de la création de la session PayPal",
      };
    }
  }

  async verifyWebhook(body: string, signature: string): Promise<any> {
    // PayPal webhook verification nécessite une implémentation spécifique
    // Pour l'instant, on retourne le body parsé
    try {
      return JSON.parse(body);
    } catch (error) {
      throw new Error("Erreur lors de la vérification du webhook PayPal");
    }
  }
}

