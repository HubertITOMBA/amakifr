/**
 * Factory pour créer le provider de paiement approprié selon la configuration
 */

import type { PaymentProvider, PaymentProviderInterface } from "./types";
import { StripeProvider } from "./stripe-provider";
import { PayPalProvider } from "./paypal-provider";
import { VirementProvider } from "./virement-provider";

/**
 * Crée le provider de paiement selon la variable d'environnement PAYMENT_PROVIDER
 */
export function createPaymentProvider(): PaymentProviderInterface {
  const provider = (process.env.PAYMENT_PROVIDER || 'stripe') as PaymentProvider;

  switch (provider) {
    case 'stripe': {
      const secretKey = process.env.STRIPE_SECRET_KEY;
      if (!secretKey) {
        throw new Error("STRIPE_SECRET_KEY est requis quand PAYMENT_PROVIDER=stripe");
      }
      return new StripeProvider(secretKey);
    }

    case 'paypal': {
      const clientId = process.env.PAYPAL_CLIENT_ID;
      const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
      const mode = (process.env.PAYPAL_MODE || 'sandbox') as 'sandbox' | 'live';

      if (!clientId || !clientSecret) {
        throw new Error("PAYPAL_CLIENT_ID et PAYPAL_CLIENT_SECRET sont requis quand PAYMENT_PROVIDER=paypal");
      }

      return new PayPalProvider(clientId, clientSecret, mode);
    }

    case 'virement': {
      return new VirementProvider();
    }

    default:
      throw new Error(`Provider de paiement non supporté: ${provider}. Valeurs possibles: stripe, paypal, virement`);
  }
}

// Instance singleton du provider
let paymentProviderInstance: PaymentProviderInterface | null = null;

/**
 * Obtient l'instance du provider de paiement (singleton)
 */
export function getPaymentProvider(): PaymentProviderInterface {
  if (!paymentProviderInstance) {
    paymentProviderInstance = createPaymentProvider();
  }
  return paymentProviderInstance;
}

