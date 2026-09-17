/**
 * Notification interne + outbox push pour un règlement fresh (lot 4.5).
 * Textes génériques uniquement — aucune donnée financière sensible.
 */
import { TypeNotification, type Prisma } from "@prisma/client";

export const REGLEMENT_NOTIFY_TITRE = "Règlement enregistré";

export const REGLEMENT_NOTIFY_MESSAGE =
  "Un règlement a été enregistré sur votre note de frais. Consultez le détail pour en savoir plus.";

export type NoteFraisReglementNotifyKind =
  | "REGLEMENT_COMPENSATION"
  | "REGLEMENT_REMBOURSEMENT"
  | "REGLEMENT_MIXTE";

type TxClient = Prisma.TransactionClient;

/**
 * Construit le lien membre vers le détail authentifié de la note.
 *
 * @param noteId - Identifiant de la note de frais
 */
export function buildNoteFraisReglementNotifyLien(noteId: string): string {
  return `/user/frais-avances/${noteId}`;
}

/**
 * Construit l'eventKey outbox unique pour un règlement / opération.
 *
 * @param kind - Discriminant technique outbox
 * @param noteId - Note concernée
 * @param anchorId - reglementId (comp/remb) ou operationId (mixte)
 */
export function buildNoteFraisReglementOutboxEventKey(
  kind: NoteFraisReglementNotifyKind,
  noteId: string,
  anchorId: string
): string {
  switch (kind) {
    case "REGLEMENT_COMPENSATION":
      return `note:${noteId}:reglement:${anchorId}:compensation`;
    case "REGLEMENT_REMBOURSEMENT":
      return `note:${noteId}:reglement:${anchorId}:remboursement`;
    case "REGLEMENT_MIXTE":
      return `note:${noteId}:operation:${anchorId}:mixte`;
  }
}

/**
 * Crée atomiquement la notification demandeur et l'événement outbox push
 * dans la transaction de règlement (après écritures financières).
 *
 * Payload push : titre/message génériques + lien uniquement (pas de montant,
 * moyen, référence, cible, motif, ni discriminant métier dans le texte).
 *
 * @param tx - Client transaction Prisma
 * @param params - Destinataire, note, kind technique, ancre d'idempotence outbox
 */
export async function createNoteFraisReglementNotificationInTx(
  tx: TxClient,
  params: {
    noteId: string;
    demandeurUserId: string;
    kind: NoteFraisReglementNotifyKind;
    /** reglementId (4.1/4.2) ou operationId (4.3). */
    anchorId: string;
  }
): Promise<void> {
  const lien = buildNoteFraisReglementNotifyLien(params.noteId);
  const eventKey = buildNoteFraisReglementOutboxEventKey(
    params.kind,
    params.noteId,
    params.anchorId
  );

  await tx.notification.create({
    data: {
      userId: params.demandeurUserId,
      type: TypeNotification.Action,
      titre: REGLEMENT_NOTIFY_TITRE,
      message: REGLEMENT_NOTIFY_MESSAGE,
      lien,
      lue: false,
    },
  });

  await tx.noteFraisOutboxEvent.create({
    data: {
      noteFraisId: params.noteId,
      eventKey,
      kind: params.kind,
      payload: {
        userIds: [params.demandeurUserId],
        titre: REGLEMENT_NOTIFY_TITRE,
        message: REGLEMENT_NOTIFY_MESSAGE,
        lien,
      },
      status: "PENDING",
    },
  });
}
