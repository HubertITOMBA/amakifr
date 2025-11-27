import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-12-18.acacia",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Webhook Stripe pour gérer les événements de paiement
 * Valide automatiquement les paiements réussis
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Signature ou secret manquant" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Erreur de validation du webhook Stripe:", err);
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  try {
    // Gérer les différents types d'événements
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Récupérer le paiement en attente
        const paiement = await db.paiementCotisation.findFirst({
          where: { stripeSessionId: session.id },
        });

        if (!paiement) {
          console.error(`Paiement non trouvé pour la session Stripe: ${session.id}`);
          return NextResponse.json({ received: true });
        }

        // Vérifier que le paiement a bien été effectué
        if (session.payment_status === "paid") {
          // Mettre à jour le statut du paiement
          await db.paiementCotisation.update({
            where: { id: paiement.id },
            data: {
              statut: "Valide",
              stripePaymentIntentId: session.payment_intent as string || null,
              transactionId: session.id,
              reference: `STRIPE-${session.id}`,
            },
          });

          // Appliquer le paiement aux cotisations/dettes
          const montantPaiement = new Decimal(paiement.montant);

          if (paiement.cotisationMensuelleId) {
            const cotisation = await db.cotisationMensuelle.findUnique({
              where: { id: paiement.cotisationMensuelleId },
            });

            if (cotisation) {
              const nouveauMontantPaye = new Decimal(cotisation.montantPaye).plus(montantPaiement);
              const nouveauMontantRestant = new Decimal(cotisation.montantAttendu).minus(nouveauMontantPaye);
              const nouveauStatut = nouveauMontantRestant.lte(0) 
                ? "Paye" 
                : nouveauMontantPaye.gt(0) 
                  ? "PartiellementPaye" 
                  : "EnAttente";

              await db.cotisationMensuelle.update({
                where: { id: cotisation.id },
                data: {
                  montantPaye: nouveauMontantPaye,
                  montantRestant: nouveauMontantRestant.gt(0) ? nouveauMontantRestant : new Decimal(0),
                  statut: nouveauStatut,
                },
              });
            }
          } else if (paiement.assistanceId) {
            const assistance = await db.assistance.findUnique({
              where: { id: paiement.assistanceId },
            });

            if (assistance) {
              const nouveauMontantPaye = new Decimal(assistance.montantPaye).plus(montantPaiement);
              const nouveauMontantRestant = new Decimal(assistance.montant).minus(nouveauMontantPaye);
              const nouveauStatut = nouveauMontantRestant.lte(0) ? "Paye" : "EnAttente";

              await db.assistance.update({
                where: { id: assistance.id },
                data: {
                  montantPaye: nouveauMontantPaye,
                  montantRestant: nouveauMontantRestant.gt(0) ? nouveauMontantRestant : new Decimal(0),
                  statut: nouveauStatut,
                },
              });
            }
          } else if (paiement.detteInitialeId) {
            const dette = await db.detteInitiale.findUnique({
              where: { id: paiement.detteInitialeId },
            });

            if (dette) {
              const nouveauMontantPaye = new Decimal(dette.montantPaye).plus(montantPaiement);
              const nouveauMontantRestant = new Decimal(dette.montant).minus(nouveauMontantPaye);

              await db.detteInitiale.update({
                where: { id: dette.id },
                data: {
                  montantPaye: nouveauMontantPaye,
                  montantRestant: nouveauMontantRestant.gt(0) ? nouveauMontantRestant : new Decimal(0),
                },
              });
            }
          }

          // Revalider les pages concernées
          revalidatePath("/user/profile");
          revalidatePath("/admin/finances");
          revalidatePath("/paiement");
        }

        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log(`Paiement réussi: ${paymentIntent.id}`);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        // Mettre à jour le statut du paiement en échec
        const paiement = await db.paiementCotisation.findFirst({
          where: { stripePaymentIntentId: paymentIntent.id },
        });

        if (paiement) {
          await db.paiementCotisation.update({
            where: { id: paiement.id },
            data: { statut: "Annule" },
          });
        }

        console.error(`Paiement échoué: ${paymentIntent.id}`);
        break;
      }

      default:
        console.log(`Événement non géré: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Erreur lors du traitement du webhook:", error);
    return NextResponse.json(
      { error: "Erreur lors du traitement du webhook" },
      { status: 500 }
    );
  }
}

// Désactiver le body parsing pour les webhooks Stripe
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

