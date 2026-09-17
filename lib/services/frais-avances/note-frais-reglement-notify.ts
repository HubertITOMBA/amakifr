/**
 * Notification interne + outbox push pour un règlement / correction fresh (lots 4.5–4.6).
 * Textes génériques uniquement — aucune donnée financière sensible.
 */
import { TypeNotification, type Prisma } from "@prisma/client";

export const REGLEMENT_NOTIFY_TITRE = "Règlement enregistré";

export const REGLEMENT_NOTIFY_MESSAGE =
  "Un règlement a été enregistré sur votre note de frais. Consultez le détail pour en savoir plus.";

export const CORRECTION_NOTIFY_TITRE = "Correction de règlement enregistrée";

export const CORRECTION_NOTIFY_MESSAGE =
  "Une correction a été enregistrée sur un règlement de votre note de frais. Consultez le détail pour en savoir plus.";

export type NoteFraisReglementNotifyKind =
  | "REGLEMENT_COMPENSATION"
  | "REGLEMENT_REMBOURSEMENT"
  | "REGLEMENT_MIXTE"
  | "CORRECTION_REFERENCE"
  | "CORRECTION_MONTANT_NEGATIF";

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
 * Construit l'eventKey outbox unique pour un règlement / opération / correction.
 *
 * @param kind - Discriminant technique outbox
 * @param noteId - Note concernée
 * @param anchorId - reglementId, operationId ou correctionId
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
    case "CORRECTION_REFERENCE":
    case "CORRECTION_MONTANT_NEGATIF":
      return `note:${noteId}:correction:${anchorId}`;
  }
}

function notifyCopy(kind: NoteFraisReglementNotifyKind): {
  titre: string;
  message: string;
} {
  if (
    kind === "CORRECTION_REFERENCE" ||
    kind === "CORRECTION_MONTANT_NEGATIF"
  ) {
    return {
      titre: CORRECTION_NOTIFY_TITRE,
      message: CORRECTION_NOTIFY_MESSAGE,
    };
  }
  return {
    titre: REGLEMENT_NOTIFY_TITRE,
    message: REGLEMENT_NOTIFY_MESSAGE,
  };
}

/**
 * Crée atomiquement la notification demandeur et l'événement outbox push
 * dans la transaction (après écritures financières / correction).
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
    /** reglementId (4.1/4.2), operationId (4.3) ou correctionId (4.6). */
    anchorId: string;
  }
): Promise<void> {
  const lien = buildNoteFraisReglementNotifyLien(params.noteId);
  const eventKey = buildNoteFraisReglementOutboxEventKey(
    params.kind,
    params.noteId,
    params.anchorId
  );
  const { titre, message } = notifyCopy(params.kind);

  await tx.notification.create({
    data: {
      userId: params.demandeurUserId,
      type: TypeNotification.Action,
      titre,
      message,
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
        titre,
        message,
        lien,
      },
      status: "PENDING",
    },
  });
}
