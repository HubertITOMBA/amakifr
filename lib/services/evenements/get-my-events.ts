import type { AuthContext } from "@/lib/auth-context";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import { decimalToMoneyString } from "@/lib/services/cotisations/decimal-to-money-string";
import {
  canMemberSeeEvent,
  canRegisterToEvent,
  canWithdrawFromEvent,
  computePlacesRestantes,
  eventStatusLabel,
  buildEventScopeWhere,
  parseEventPagination,
} from "@/lib/services/evenements/event-helpers";
import {
  canDeclareEventInscriptionPayment,
  canSelfWithdrawEventInscription,
  inscriptionMontantRestant,
} from "@/lib/services/evenements/inscription-payment";
import type {
  EventScope,
  MyEventDetailDto,
  MyEventListItemDto,
  MyEventsListDto,
  MyEventsSummaryDto,
} from "@/lib/services/evenements/types";

/**
 * Résout l'adhérent self-service depuis actor.userId.
 */
export async function resolveSelfAdherentId(
  actor: AuthContext
): Promise<string> {
  if (!actor?.userId || String(actor.userId).trim() === "") {
    throw new ServiceError("UNAUTHENTICATED", "Non autorisé");
  }
  const adherent = await db.adherent.findUnique({
    where: { userId: actor.userId },
    select: { id: true },
  });
  if (!adherent) {
    throw new ServiceError("NOT_FOUND", "Adhérent introuvable");
  }
  return adherent.id;
}

type InscriptionRow = {
  id: string;
  nombrePersonnes?: number;
  montantAttendu?: Prisma.Decimal | number;
  montantPaye?: Prisma.Decimal | number;
  statutPaiement?: string;
  statut?: string;
  hasPendingPayment?: boolean;
} | null;

function mapListItem(
  event: {
    id: string;
    titre: string;
    description: string;
    categorie: string;
    statut: string;
    dateDebut: Date;
    dateFin: Date | null;
    dateAffichage: Date;
    dateFinAffichage: Date;
    lieu: string | null;
    prix?: Prisma.Decimal | number | null;
    inscriptionRequis: boolean;
    obligatoireParticipation: boolean;
    dateLimiteInscription: Date | null;
    placesDisponibles: number | null;
    placesReservees: number;
  },
  inscription: InscriptionRow,
  now: Date
): MyEventListItemDto {
  const estInscrit = Boolean(inscription);
  const canRegister = canRegisterToEvent(event, estInscrit, now);
  let canWithdraw = canWithdrawFromEvent(event, estInscrit, now);
  if (canWithdraw && inscription) {
    const gate = canSelfWithdrawEventInscription({
      montantPaye: inscription.montantPaye ?? 0,
      hasPendingPayment: Boolean(inscription.hasPendingPayment),
    });
    canWithdraw = gate.allowed;
  }
  const prixNum =
    event.prix != null ? Number(event.prix) : null;
  return {
    id: event.id,
    titre: event.titre,
    description: event.description,
    categorie: event.categorie,
    dateDebut: event.dateDebut.toISOString(),
    dateFin: event.dateFin?.toISOString() ?? null,
    lieu: event.lieu,
    statutLabel: eventStatusLabel(event, now),
    inscriptionRequis: event.inscriptionRequis,
    dateLimiteInscription: event.dateLimiteInscription?.toISOString() ?? null,
    placesDisponibles: event.placesDisponibles,
    placesReservees: event.placesReservees,
    placesRestantes: computePlacesRestantes(
      event.placesDisponibles,
      event.placesReservees
    ),
    estInscrit,
    canRegister,
    canWithdraw,
    obligatoireParticipation: event.obligatoireParticipation,
    prix:
      prixNum != null && Number.isFinite(prixNum) && prixNum > 0
        ? decimalToMoneyString(prixNum)
        : null,
  };
}


function buildWhere(scope: EventScope, now: Date) {
  return buildEventScopeWhere(scope, now);
}

/**
 * Liste paginée des événements visibles pour l'adhérent.
 *
 * @param actor - Identité authentifiée
 * @param options - scope upcoming|past, limit, offset
 */
export async function getMyEvents(
  actor: AuthContext,
  options: {
    scope?: EventScope;
    limit?: number;
    offset?: number;
  } = {}
): Promise<MyEventsListDto> {
  const adherentId = await resolveSelfAdherentId(actor);
  const now = new Date();
  const scope: EventScope = options.scope === "past" ? "past" : "upcoming";
  const { limit, offset } = parseEventPagination(
    options.limit != null ? String(options.limit) : null,
    options.offset != null ? String(options.offset) : null
  );

  try {
    const where = buildWhere(scope, now);
    const [total, rows] = await Promise.all([
      db.evenement.count({ where }),
      db.evenement.findMany({
        where,
        orderBy: { dateDebut: scope === "past" ? "desc" : "asc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          titre: true,
          description: true,
          categorie: true,
          statut: true,
          dateDebut: true,
          dateFin: true,
          dateAffichage: true,
          dateFinAffichage: true,
          lieu: true,
          prix: true,
          inscriptionRequis: true,
          obligatoireParticipation: true,
          dateLimiteInscription: true,
          placesDisponibles: true,
          placesReservees: true,
          Inscriptions: {
            where: { adherentId },
            select: {
              id: true,
              nombrePersonnes: true,
              montantAttendu: true,
              montantPaye: true,
              statutPaiement: true,
              statut: true,
              Paiements: {
                where: { statut: "EnAttente" },
                select: { id: true },
                take: 1,
              },
            },
            take: 1,
          },
        },
      }),
    ]);

    const items = rows.map((row) => {
      const insc = row.Inscriptions[0] ?? null;
      return mapListItem(
        row,
        insc
          ? {
              ...insc,
              hasPendingPayment: (insc.Paiements?.length ?? 0) > 0,
            }
          : null,
        now
      );
    });

    return { items, total, limit, offset };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    console.error("[getMyEvents] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors de la récupération des événements"
    );
  }
}

/**
 * Summary léger accueil (count + prochain événement).
 */
export async function getMyEventsSummary(
  actor: AuthContext
): Promise<MyEventsSummaryDto> {
  const adherentId = await resolveSelfAdherentId(actor);
  const now = new Date();
  try {
    const whereUpcoming = buildWhere("upcoming", now);
    const [upcomingCount, next] = await Promise.all([
      db.evenement.count({ where: whereUpcoming }),
      // Prochain = dateDebut la plus proche dans le futur (pas createdAt)
      db.evenement.findFirst({
        where: {
          statut: "Publie",
          dateDebut: { gt: now },
        },
        orderBy: { dateDebut: "asc" },
        select: {
          id: true,
          titre: true,
          dateDebut: true,
          lieu: true,
        },
      }),
    ]);
    void adherentId;
    return {
      upcomingCount,
      nextEvent: next
        ? {
            id: next.id,
            titre: next.titre,
            dateDebut: next.dateDebut.toISOString(),
            lieu: next.lieu,
          }
        : null,
    };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    console.error("[getMyEventsSummary] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors du résumé des événements"
    );
  }
}

/**
 * Détail d'un événement visible pour l'adhérent.
 */
export async function getMyEvent(
  actor: AuthContext,
  eventId: string
): Promise<MyEventDetailDto> {
  const adherentId = await resolveSelfAdherentId(actor);
  const now = new Date();

  if (!eventId?.trim()) {
    throw new ServiceError("VALIDATION_ERROR", "Identifiant invalide");
  }

  try {
    const event = await db.evenement.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        titre: true,
        description: true,
        contenu: true,
        categorie: true,
        statut: true,
        dateDebut: true,
        dateFin: true,
        dateAffichage: true,
        dateFinAffichage: true,
        lieu: true,
        adresse: true,
        prix: true,
        inscriptionRequis: true,
        obligatoireParticipation: true,
        dateLimiteInscription: true,
        placesDisponibles: true,
        placesReservees: true,
        contactEmail: true,
        contactTelephone: true,
        imagePrincipale: true,
        tags: true,
        estPublic: true,
        Inscriptions: {
          where: { adherentId },
          select: {
            id: true,
            nombrePersonnes: true,
            montantAttendu: true,
            montantPaye: true,
            statutPaiement: true,
            statut: true,
            Paiements: {
              orderBy: { datePaiement: "desc" },
              select: {
                id: true,
                montant: true,
                moyenPaiement: true,
                statut: true,
                datePaiement: true,
                reference: true,
              },
            },
          },
          take: 1,
        },
      },
    });

    if (!event || !canMemberSeeEvent(event, now)) {
      throw new ServiceError("NOT_FOUND", "Événement introuvable");
    }

    let tags: string[] | null = null;
    if (event.tags) {
      try {
        const parsed = JSON.parse(event.tags);
        tags = Array.isArray(parsed) ? parsed.map(String) : null;
      } catch {
        tags = null;
      }
    }

    const rawInscription = event.Inscriptions[0] ?? null;
    const hasPendingPayment = (rawInscription?.Paiements ?? []).some(
      (p) => p.statut === "EnAttente"
    );
    const inscription = rawInscription
      ? { ...rawInscription, hasPendingPayment }
      : null;
    const base = mapListItem(event, inscription, now);

    let montantAttendu: string | null = null;
    let montantPaye: string | null = null;
    let montantRestant: string | null = null;
    let statutPaiement: string | null = null;
    let paymentRequired = false;
    let canPay = false;
    const paiements =
      rawInscription?.Paiements.map((p) => ({
        id: p.id,
        montant: decimalToMoneyString(p.montant),
        moyenPaiement: p.moyenPaiement,
        statut: p.statut,
        datePaiement: p.datePaiement.toISOString(),
        reference: p.reference,
        destinationLabel: `Événement — ${event.titre}`,
      })) ?? [];

    if (inscription) {
      const attendu = new Prisma.Decimal(inscription.montantAttendu ?? 0);
      const paye = new Prisma.Decimal(inscription.montantPaye ?? 0);
      const restant = inscriptionMontantRestant(attendu, paye);
      montantAttendu = decimalToMoneyString(attendu);
      montantPaye = decimalToMoneyString(paye);
      montantRestant = decimalToMoneyString(restant);
      statutPaiement = inscription.statutPaiement ?? null;
      paymentRequired = attendu.gt(0);
      canPay = canDeclareEventInscriptionPayment({
        statutPaiement: inscription.statutPaiement ?? "NonApplicable",
        montantRestant: restant,
        hasPendingPayment,
        inscriptionStatut: inscription.statut,
      });
    } else {
      const unit = event.prix != null ? Number(event.prix) : 0;
      paymentRequired = Number.isFinite(unit) && unit > 0;
    }

    return {
      ...base,
      contenu: event.contenu,
      adresse: event.adresse,
      contactEmail: event.contactEmail,
      contactTelephone: event.contactTelephone,
      imagePrincipale: event.imagePrincipale,
      tags,
      inscriptionId: inscription?.id ?? null,
      nombrePersonnes: inscription?.nombrePersonnes ?? null,
      estPublic: event.estPublic,
      montantAttendu,
      montantPaye,
      montantRestant,
      statutPaiement,
      paymentRequired,
      hasPendingPayment,
      canPay,
      paiements,
    };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    console.error("[getMyEvent] Erreur:", error);
    throw new ServiceError(
      "INTERNAL_ERROR",
      "Erreur lors de la récupération de l'événement"
    );
  }
}
