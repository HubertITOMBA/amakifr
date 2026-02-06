import { NextRequest, NextResponse } from "next/server";
import createMollieClient from "@mollie/api-client";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Webhook Mollie : Mollie envoie une requête GET avec ?id=tr_xxx lorsque le statut du paiement change.
 * On récupère le paiement côté Mollie, et si status === 'paid', on valide le paiement en base et on l'applique.
 */
export async function GET(request: NextRequest) {
  const paymentId = request.nextUrl.searchParams.get("id");
  if (!paymentId) {
    return NextResponse.json({ error: "Paramètre id manquant" }, { status: 400 });
  }

  const apiKey = process.env.MOLLIE_API_KEY;
  if (!apiKey) {
    console.error("MOLLIE_API_KEY manquant");
    return NextResponse.json({ error: "Configuration manquante" }, { status: 500 });
  }

  try {
    const mollie = createMollieClient({ apiKey });
    const payment = await mollie.payments.get(paymentId);

    if (payment.status !== "paid") {
      return NextResponse.json({ received: true, status: payment.status });
    }

    const paiement = await db.paiementCotisation.findFirst({
      where: { molliePaymentId: paymentId },
    });

    if (!paiement) {
      console.error(`Paiement non trouvé pour Mollie: ${paymentId}`);
      return NextResponse.json({ received: true });
    }

    // Déjà traité
    if (paiement.statut === "Valide") {
      return NextResponse.json({ received: true });
    }

    // Mettre à jour le statut
    await db.paiementCotisation.update({
      where: { id: paiement.id },
      data: {
        statut: "Valide",
        transactionId: paymentId,
        reference: `MOLLIE-${paymentId}`,
      },
    });

    const montantPaiement = new Decimal(paiement.montant);
    let excédent = new Decimal(0);

    if (paiement.cotisationMensuelleId) {
      const cotisation = await db.cotisationMensuelle.findUnique({
        where: { id: paiement.cotisationMensuelleId },
      });
      if (cotisation) {
        const montantEffectivementPaye = Decimal.min(montantPaiement, new Decimal(cotisation.montantRestant));
        excédent = montantPaiement.minus(montantEffectivementPaye);
        const nouveauMontantPaye = new Decimal(cotisation.montantPaye).plus(montantEffectivementPaye);
        const nouveauMontantRestant = new Decimal(cotisation.montantRestant).minus(montantEffectivementPaye);
        const nouveauStatut =
          nouveauMontantRestant.lte(0) ? "Paye" : nouveauMontantPaye.gt(0) ? "PartiellementPaye" : "EnAttente";
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
        const restant = new Decimal(assistance.montantRestant);
        const montantEffectivementPaye = Decimal.min(montantPaiement, restant);
        excédent = montantPaiement.minus(montantEffectivementPaye);
        const nouveauMontantPaye = new Decimal(assistance.montantPaye).plus(montantEffectivementPaye);
        const nouveauMontantRestant = restant.minus(montantEffectivementPaye);
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
        const restant = new Decimal(dette.montantRestant);
        const montantEffectivementPaye = Decimal.min(montantPaiement, restant);
        excédent = montantPaiement.minus(montantEffectivementPaye);
        const nouveauMontantPaye = new Decimal(dette.montantPaye).plus(montantEffectivementPaye);
        const nouveauMontantRestant = restant.minus(montantEffectivementPaye);
        await db.detteInitiale.update({
          where: { id: dette.id },
          data: {
            montantPaye: nouveauMontantPaye,
            montantRestant: nouveauMontantRestant.gt(0) ? nouveauMontantRestant : new Decimal(0),
          },
        });
      }
    }

    if (excédent.gt(0)) {
      await db.avoir.create({
        data: {
          adherentId: paiement.adherentId,
          montant: excédent,
          montantUtilise: new Decimal(0),
          montantRestant: excédent,
          paiementId: paiement.id,
          description: `Avoir créé suite à un excédent de paiement Mollie (${excédent.toFixed(2)}€)`,
          statut: "Disponible",
        },
      });
      const { appliquerAvoirSurDettesInitiales } = await import("@/actions/paiements/index");
      await appliquerAvoirSurDettesInitiales(paiement.adherentId);
    }

    revalidatePath("/user/profile");
    revalidatePath("/admin/finances");
    revalidatePath("/paiement");

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Erreur webhook Mollie:", error);
    return NextResponse.json(
      { error: "Erreur lors du traitement du webhook" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
