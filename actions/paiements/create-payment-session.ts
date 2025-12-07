"use server";

/**
 * Action serveur générique pour créer une session de paiement
 * Utilise le provider configuré (Stripe, PayPal, ou Virement)
 */

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getPaymentProvider } from "@/lib/payment/providers";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Crée une session de paiement avec le provider configuré
 * 
 * @param data - Les données du paiement (montant, type, ID de l'obligation/cotisation, etc.)
 * @returns Un objet avec success, sessionId et url pour rediriger l'utilisateur
 */
export async function createPaymentSession(data: {
  montant: number;
  adherentId: string;
  type: "cotisation-mensuelle" | "assistance" | "dette-initiale" | "obligation" | "adhesion" | "general";
  itemId?: string;
  description?: string;
  metadata?: Record<string, string>;
}): Promise<{
  success: boolean;
  sessionId?: string;
  url?: string;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé. Vous devez être connecté." };
    }

    // Vérifier que l'utilisateur est bien l'adhérent concerné ou un admin
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      include: { adherent: true },
    });

    if (!user) {
      return { success: false, error: "Utilisateur non trouvé" };
    }

    // Vérifier que l'adhérent existe
    const adherent = await db.adherent.findUnique({
      where: { id: data.adherentId },
      include: { User: true },
    });

    if (!adherent) {
      return { success: false, error: "Adhérent non trouvé" };
    }

    // Vérifier que l'utilisateur est l'adhérent concerné ou un admin
    if (user.role !== "Admin" && user.adherent?.id !== data.adherentId) {
      return { success: false, error: "Vous n'êtes pas autorisé à effectuer ce paiement" };
    }

    // Construire la description du paiement
    let description = data.description || "Paiement AMAKI France";
    if (data.type === "cotisation-mensuelle" && data.itemId) {
      const cotisation = await db.cotisationMensuelle.findUnique({
        where: { id: data.itemId },
        include: { TypeCotisation: true },
      });
      if (cotisation && cotisation.TypeCotisation) {
        description = `Cotisation mensuelle - ${cotisation.TypeCotisation.nom} - ${cotisation.periode}`;
      }
    } else if (data.type === "assistance" && data.itemId) {
      const assistance = await db.assistance.findUnique({
        where: { id: data.itemId },
      });
      if (assistance) {
        description = `Assistance - ${assistance.type}`;
      }
    } else if (data.type === "dette-initiale" && data.itemId) {
      const dette = await db.detteInitiale.findUnique({
        where: { id: data.itemId },
      });
      if (dette) {
        description = `Dette initiale - ${dette.type}`;
      }
    } else if (data.type === "obligation" && data.itemId) {
      const obligation = await db.obligationCotisation.findUnique({
        where: { id: data.itemId },
        include: { Adherent: true },
      });
      if (obligation) {
        description = `Obligation de cotisation - ${obligation.periode}`;
      }
    } else if (data.type === "adhesion") {
      description = "Frais d'adhésion AMAKI France";
    }

    // Obtenir le provider de paiement configuré
    const paymentProvider = getPaymentProvider();
    
    // Obtenir le type de provider (string) pour déterminer le moyen de paiement
    const paymentProviderType = (process.env.PAYMENT_PROVIDER || 'stripe') as 'stripe' | 'paypal' | 'virement';

    // Créer la session de paiement
    const result = await paymentProvider.createCheckoutSession({
      montant: data.montant,
      adherentId: data.adherentId,
      userId: session.user.id,
      type: data.type,
      itemId: data.itemId,
      description,
      metadata: {
        adherentName: `${adherent.firstname} ${adherent.lastname}`,
        ...data.metadata,
      },
      customerEmail: adherent.User.email || undefined,
    });

    if (!result.success) {
      return result;
    }

    // Déterminer le moyen de paiement et les champs selon le provider
    let moyenPaiement: "Stripe" | "PayPal" | "Virement" = "Stripe";
    let paiementData: any = {
      adherentId: data.adherentId,
      montant: new Decimal(data.montant),
      datePaiement: new Date(),
      statut: paymentProviderType === 'virement' ? "EnAttente" : "EnCours",
      createdBy: session.user.id,
      cotisationMensuelleId: data.type === "cotisation-mensuelle" ? data.itemId : null,
      assistanceId: data.type === "assistance" ? data.itemId : null,
      detteInitialeId: data.type === "dette-initiale" ? data.itemId : null,
      obligationCotisationId: data.type === "obligation" ? data.itemId : null,
      description: description,
      transactionId: result.sessionId || null,
    };

    if (paymentProviderType === 'stripe') {
      moyenPaiement = "Stripe";
      paiementData.stripeSessionId = result.sessionId || null;
    } else if (paymentProviderType === 'paypal') {
      moyenPaiement = "PayPal";
      paiementData.paypalOrderId = result.sessionId || null;
    } else if (paymentProviderType === 'virement') {
      moyenPaiement = "Virement";
      paiementData.reference = result.sessionId || null;
    }

    paiementData.moyenPaiement = moyenPaiement;

    // Créer un enregistrement de paiement en attente
    const paiement = await db.paiementCotisation.create({
      data: paiementData,
    });

    return {
      success: true,
      sessionId: result.sessionId,
      url: result.url,
    };
  } catch (error: any) {
    console.error("Erreur lors de la création de la session de paiement:", error);
    return {
      success: false,
      error: error.message || "Une erreur s'est produite lors de la création de la session de paiement",
    };
  } finally {
    revalidatePath("/paiement");
  }
}

