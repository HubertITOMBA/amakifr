import { z } from "zod";
import { Prisma } from "@prisma/client";
import type { AuthContext } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import { sendAdherentInscriptionConfirmationEmail } from "@/lib/mail";
import {
  canMemberSeeEvent,
  isEventRegistrationOpen,
} from "@/lib/services/evenements/event-helpers";
import {
  canSelfWithdrawEventInscription,
  computeInscriptionMontantAttendu,
  initialStatutPaiementEvenement,
} from "@/lib/services/evenements/inscription-payment";
import { resolveSelfAdherentId } from "@/lib/services/evenements/get-my-events";
import type { MyEventInscriptionResultDto } from "@/lib/services/evenements/types";
import { decimalToMoneyString } from "@/lib/services/cotisations/decimal-to-money-string";

const RegisterSchema = z.object({
  nombrePersonnes: z
    .number({ invalid_type_error: "Nombre de personnes invalide" })
    .int("Nombre de personnes invalide")
    .min(1, "Au moins une personne doit être inscrite")
    .max(20, "Nombre de personnes trop élevé"),
  commentaires: z.string().max(2000).optional(),
});

/**
 * Inscription self-service (miroir inscrireEvenement Web).
 * Snapshot montantAttendu = prix × nombrePersonnes (jamais depuis le client).
 */
export async function registerMyEvent(
  actor: AuthContext,
  eventId: string,
  input: { nombrePersonnes: number; commentaires?: string }
): Promise<MyEventInscriptionResultDto> {
  const adherentId = await resolveSelfAdherentId(actor);
  const parsed = RegisterSchema.safeParse(input);
  if (!parsed.success) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      parsed.error.errors[0]?.message ?? "Données invalides"
    );
  }
  if (!eventId?.trim()) {
    throw new ServiceError("VALIDATION_ERROR", "Identifiant invalide");
  }

  const { nombrePersonnes, commentaires } = parsed.data;
  const now = new Date();

  try {
    const result = await db.$transaction(async (tx) => {
      const evenement = await tx.evenement.findUnique({
        where: { id: eventId },
      });
      if (!evenement || !canMemberSeeEvent(evenement, now)) {
        throw new ServiceError("NOT_FOUND", "Événement introuvable");
      }
      if (!evenement.inscriptionRequis) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          "Cet événement ne nécessite pas d'inscription"
        );
      }
      if (!isEventRegistrationOpen(evenement, now)) {
        if (
          evenement.dateLimiteInscription &&
          evenement.dateLimiteInscription < now
        ) {
          throw new ServiceError(
            "FORBIDDEN",
            "La date limite d'inscription est dépassée"
          );
        }
        throw new ServiceError("FORBIDDEN", "Pas assez de places disponibles");
      }
      if (
        evenement.placesDisponibles != null &&
        evenement.placesReservees + nombrePersonnes >
          evenement.placesDisponibles
      ) {
        throw new ServiceError("FORBIDDEN", "Pas assez de places disponibles");
      }

      const existing = await tx.inscriptionEvenement.findFirst({
        where: { evenementId: eventId, adherentId },
        select: { id: true },
      });
      if (existing) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          "Vous êtes déjà inscrit à cet événement"
        );
      }

      const montantAttendu = computeInscriptionMontantAttendu(
        evenement.prix,
        nombrePersonnes
      );
      const statutPaiement = initialStatutPaiementEvenement(montantAttendu);

      const inscription = await tx.inscriptionEvenement.create({
        data: {
          evenementId: eventId,
          adherentId,
          nombrePersonnes,
          commentaires: commentaires ?? null,
          montantAttendu,
          montantPaye: new Prisma.Decimal(0),
          statutPaiement,
        },
        select: {
          id: true,
          nombrePersonnes: true,
          montantAttendu: true,
          statutPaiement: true,
        },
      });

      const capacityUpdate = await tx.evenement.updateMany({
        where: {
          id: eventId,
          ...(evenement.placesDisponibles != null
            ? {
                placesReservees: {
                  lte: evenement.placesDisponibles - nombrePersonnes,
                },
              }
            : {}),
        },
        data: {
          placesReservees: { increment: nombrePersonnes },
        },
      });

      if (capacityUpdate.count !== 1) {
        throw new ServiceError("FORBIDDEN", "Pas assez de places disponibles");
      }

      return { inscription, evenement, montantAttendu };
    });

    try {
      const adherent = await db.adherent.findUnique({
        where: { id: adherentId },
        include: { User: { select: { email: true } } },
      });
      if (adherent?.User?.email) {
        const unit = result.evenement.prix
          ? Number(result.evenement.prix)
          : 0;
        await sendAdherentInscriptionConfirmationEmail(
          adherent.User.email,
          `${adherent.civility || ""} ${adherent.firstname} ${adherent.lastname}`.trim(),
          result.evenement.titre,
          result.evenement.dateDebut,
          result.evenement.lieu,
          nombrePersonnes,
          {
            prixUnitaire: unit > 0 ? unit : null,
            montantAttendu: result.montantAttendu.gt(0)
              ? Number(result.montantAttendu)
              : null,
          }
        );
      }
    } catch (emailError) {
      console.error("[registerMyEvent] Email:", emailError);
    }

    return {
      inscriptionId: result.inscription.id,
      nombrePersonnes: result.inscription.nombrePersonnes,
      montantAttendu: decimalToMoneyString(result.inscription.montantAttendu),
      statutPaiement: result.inscription.statutPaiement,
    };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    console.error("[registerMyEvent] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors de l'inscription à l'événement"
    );
  }
}

/**
 * Désinscription self-service.
 * Refusée si paiement EnAttente ou montantPaye > 0.
 */
export async function withdrawMyEvent(
  actor: AuthContext,
  eventId: string
): Promise<{ withdrawn: true }> {
  const adherentId = await resolveSelfAdherentId(actor);
  if (!eventId?.trim()) {
    throw new ServiceError("VALIDATION_ERROR", "Identifiant invalide");
  }

  try {
    await db.$transaction(async (tx) => {
      const inscription = await tx.inscriptionEvenement.findFirst({
        where: { evenementId: eventId, adherentId },
      });
      if (!inscription) {
        throw new ServiceError("NOT_FOUND", "Inscription non trouvée");
      }
      if (inscription.adherentId !== adherentId) {
        throw new ServiceError(
          "FORBIDDEN",
          "Vous ne pouvez pas annuler cette inscription"
        );
      }

      const pending = await tx.paiementCotisation.findFirst({
        where: {
          inscriptionEvenementId: inscription.id,
          adherentId,
          statut: "EnAttente",
        },
        select: { id: true },
      });

      const gate = canSelfWithdrawEventInscription({
        montantPaye: inscription.montantPaye,
        hasPendingPayment: Boolean(pending),
      });
      if (!gate.allowed) {
        throw new ServiceError("FORBIDDEN", gate.reason ?? "Désinscription impossible");
      }

      await tx.inscriptionEvenement.delete({
        where: { id: inscription.id },
      });
      await tx.evenement.update({
        where: { id: eventId },
        data: {
          placesReservees: { decrement: inscription.nombrePersonnes },
        },
      });
    });

    return { withdrawn: true };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    console.error("[withdrawMyEvent] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors de l'annulation de l'inscription"
    );
  }
}
