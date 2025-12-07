"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import Stripe from "stripe";
import { Decimal } from "@prisma/client/runtime/library";

// Initialiser Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-12-18.acacia",
});

/**
 * Crée une session de paiement Stripe Checkout
 * 
 * @param data - Les données du paiement (montant, type, ID de l'obligation/cotisation, etc.)
 * @returns Un objet avec success, sessionId et url pour rediriger l'utilisateur
 */
export async function createStripeCheckoutSession(data: {
  montant: number;
  adherentId: string;
  type: "cotisation-mensuelle" | "assistance" | "dette-initiale" | "obligation" | "adhesion" | "general";
  itemId?: string; // ID de la cotisation, assistance, dette, etc.
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
    } else if (data.type === "adhesion") {
      description = "Frais d'adhésion AMAKI France";
    }

    // Créer la session Stripe Checkout
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"], // Carte bancaire (Visa, Mastercard, American Express)
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: description,
              description: `Paiement pour ${adherent.firstname} ${adherent.lastname}`,
            },
            unit_amount: Math.round(data.montant * 100), // Convertir en centimes
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:9050"}/paiement/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:9050"}/paiement/cancel`,
      customer_email: adherent.User.email || undefined,
      metadata: {
        adherentId: data.adherentId,
        userId: session.user.id,
        type: data.type,
        itemId: data.itemId || "",
        ...data.metadata,
      },
      // Activer Google Pay et Apple Pay
      payment_method_options: {
        card: {
          request_three_d_secure: "automatic",
        },
      },
    });

    // Créer un enregistrement de paiement en attente
    const paiement = await db.paiementCotisation.create({
      data: {
        adherentId: data.adherentId,
        montant: new Decimal(data.montant),
        datePaiement: new Date(),
        moyenPaiement: "Stripe",
        stripeSessionId: checkoutSession.id,
        statut: "EnCours",
        createdBy: session.user.id,
        // Lier au type de paiement
        cotisationMensuelleId: data.type === "cotisation-mensuelle" ? data.itemId : null,
        assistanceId: data.type === "assistance" ? data.itemId : null,
        detteInitialeId: data.type === "dette-initiale" ? data.itemId : null,
        obligationCotisationId: data.type === "obligation" ? data.itemId : null,
        description: description,
      },
    });

    return {
      success: true,
      sessionId: checkoutSession.id,
      url: checkoutSession.url || undefined,
    };
  } catch (error) {
    console.error("Erreur lors de la création de la session Stripe:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur lors de la création de la session de paiement",
    };
  }
}

/**
 * Récupère les détails d'une session Stripe
 */
export async function getStripeSession(sessionId: string) {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return { success: true, session };
  } catch (error) {
    console.error("Erreur lors de la récupération de la session Stripe:", error);
    return { success: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
  }
}

