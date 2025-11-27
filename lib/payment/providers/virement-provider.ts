/**
 * Provider Virement bancaire pour les paiements manuels
 * Les paiements sont créés en statut "EnAttente" et doivent être validés manuellement
 */

import type { PaymentProviderInterface, PaymentSessionOptions, PaymentSessionResult } from "./types";

export class VirementProvider implements PaymentProviderInterface {
  async createCheckoutSession(options: PaymentSessionOptions): Promise<PaymentSessionResult> {
    // Pour les virements, on ne crée pas de session de paiement en ligne
    // Le paiement sera créé directement en base avec le statut "EnAttente"
    // et l'administrateur devra le valider manuellement
    
    return {
      success: true,
      sessionId: `virement_${Date.now()}_${options.adherentId}`,
      url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:9050"}/paiement/virement?adherentId=${options.adherentId}&montant=${options.montant}`,
    };
  }

  async verifyWebhook(body: string, signature: string): Promise<any> {
    // Pas de webhook pour les virements manuels
    throw new Error("Les virements bancaires ne nécessitent pas de webhook");
  }
}

