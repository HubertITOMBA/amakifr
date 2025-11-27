/**
 * Types et interfaces pour les providers de paiement
 */

export type PaymentProvider = 'stripe' | 'paypal' | 'virement';

export interface PaymentSessionOptions {
  montant: number;
  adherentId: string;
  userId: string;
  type: "cotisation-mensuelle" | "assistance" | "dette-initiale" | "obligation" | "adhesion" | "general";
  itemId?: string;
  description?: string;
  metadata?: Record<string, string>;
  customerEmail?: string;
}

export interface PaymentSessionResult {
  success: boolean;
  sessionId?: string;
  url?: string;
  error?: string;
}

export interface PaymentProviderInterface {
  createCheckoutSession(options: PaymentSessionOptions): Promise<PaymentSessionResult>;
  verifyWebhook(body: string, signature: string): Promise<any>;
}

