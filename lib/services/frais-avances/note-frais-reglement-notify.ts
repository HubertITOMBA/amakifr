/**
 * Notification interne + outbox push pour un règlement / correction / restitution.
 * Textes génériques uniquement — aucune donnée financière sensible.
 */
import { TypeNotification, type Prisma } from "@prisma/client";

export const REGLEMENT_NOTIFY_TITRE = "Règlement enregistré";

export const REGLEMENT_NOTIFY_MESSAGE =
  "Un règlement a été enregistré sur votre note de frais. Consultez le détail pour en savoir plus.";

export const CORRECTION_NOTIFY_TITRE = "Correction de règlement enregistrée";

export const CORRECTION_NOTIFY_MESSAGE =
  "Une correction a été enregistrée sur un règlement de votre note de frais. Consultez le détail pour en savoir plus.";

export const RESTITUTION_NOTIFY_TITRE = "Restitution enregistrée";

export const RESTITUTION_NOTIFY_MESSAGE =
  "Une restitution a été enregistrée sur votre note de frais. Consultez le détail pour en savoir plus.";

export const ANNULATION_DEMANDE_TITRE = "Demande d'annulation de règlement";
export const ANNULATION_DEMANDE_MESSAGE =
  "Une demande d'annulation de règlement nécessite une confirmation. Consultez le détail administrateur.";

export const ANNULATION_CONFIRMEE_TITRE = "Annulation de règlement confirmée";
export const ANNULATION_CONFIRMEE_MESSAGE =
  "Une annulation de règlement a été confirmée sur une note de frais. Consultez le détail.";

export const ANNULATION_REFUSEE_TITRE = "Annulation de règlement refusée";
export const ANNULATION_REFUSEE_MESSAGE =
  "Votre demande d'annulation de règlement a été refusée. Consultez le détail administrateur.";

export type NoteFraisReglementNotifyKind =
  | "REGLEMENT_COMPENSATION"
  | "REGLEMENT_REMBOURSEMENT"
  | "REGLEMENT_MIXTE"
  | "CORRECTION_REFERENCE"
  | "CORRECTION_MONTANT_NEGATIF"
  | "RESTITUTION_ENREGISTREE"
  | "ANNULATION_DEMANDEE"
  | "ANNULATION_CONFIRMEE"
  | "ANNULATION_REFUSEE";

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
 * Construit l'eventKey outbox unique pour un règlement / opération / correction / restitution.
 *
 * @param kind - Discriminant technique outbox
 * @param noteId - Note concernée
 * @param anchorId - reglementId, operationId, correctionId ou restitutionId
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
    case "RESTITUTION_ENREGISTREE":
      return `note:${noteId}:restitution:${anchorId}`;
    case "ANNULATION_DEMANDEE":
      return `note:${noteId}:annulation:${anchorId}:demandee`;
    case "ANNULATION_CONFIRMEE":
      return `note:${noteId}:annulation:${anchorId}:confirmee`;
    case "ANNULATION_REFUSEE":
      return `note:${noteId}:annulation:${anchorId}:refusee`;
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
  if (kind === "RESTITUTION_ENREGISTREE") {
    return {
      titre: RESTITUTION_NOTIFY_TITRE,
      message: RESTITUTION_NOTIFY_MESSAGE,
    };
  }
  if (kind === "ANNULATION_DEMANDEE") {
    return {
      titre: ANNULATION_DEMANDE_TITRE,
      message: ANNULATION_DEMANDE_MESSAGE,
    };
  }
  if (kind === "ANNULATION_CONFIRMEE") {
    return {
      titre: ANNULATION_CONFIRMEE_TITRE,
      message: ANNULATION_CONFIRMEE_MESSAGE,
    };
  }
  if (kind === "ANNULATION_REFUSEE") {
    return {
      titre: ANNULATION_REFUSEE_TITRE,
      message: ANNULATION_REFUSEE_MESSAGE,
    };
  }
  return {
    titre: REGLEMENT_NOTIFY_TITRE,
    message: REGLEMENT_NOTIFY_MESSAGE,
  };
}

/**
 * Crée atomiquement la notification demandeur et l'événement outbox push
 * dans la transaction (après écritures financières / correction / restitution).
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
    /** reglementId (4.1/4.2), operationId (4.3), correctionId (4.6) ou restitutionId (4.7). */
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

/**
 * Notifications multi-destinataires pour transitions d'annulation (lot 4.8).
 * Une notif in-app + une outbox par groupe (lien/audience).
 * CONFIRMEE : audiences user/admin → eventKeys `…:confirmee:user` / `…:confirmee:admin`.
 */
export async function createNoteFraisAnnulationNotificationsInTx(
  tx: TxClient,
  params: {
    noteId: string;
    kind:
      | "ANNULATION_DEMANDEE"
      | "ANNULATION_CONFIRMEE"
      | "ANNULATION_REFUSEE";
    demandeId: string;
    /** Destinataires avec lien (et audience pour CONFIRMEE). */
    recipients?: Array<{
      userId: string;
      lien: string;
      audience?: "user" | "admin";
    }>;
    /** Compat : même lien pour tous (DEMANDEE / REFUSEE). */
    userIds?: string[];
    lien?: string;
  }
): Promise<void> {
  const { titre, message } = notifyCopy(params.kind);

  let recipients = params.recipients ?? [];
  if (recipients.length === 0 && params.userIds && params.lien) {
    recipients = [...new Set(params.userIds.filter(Boolean))].map((userId) => ({
      userId,
      lien: params.lien!,
    }));
  }
  // Dédupliquer par userId (premier gagne — CONFIRMEE : user avant admin si doublon).
  const seen = new Set<string>();
  const deduped: typeof recipients = [];
  for (const r of recipients) {
    if (!r.userId || seen.has(r.userId)) continue;
    seen.add(r.userId);
    deduped.push(r);
  }
  if (deduped.length === 0) return;

  // Grouper par (lien, audience) → une outbox par groupe
  const groups = new Map<
    string,
    { userIds: string[]; lien: string; audience?: "user" | "admin" }
  >();
  for (const r of deduped) {
    const gKey = `${r.audience ?? ""}|${r.lien}`;
    const g = groups.get(gKey) ?? {
      userIds: [],
      lien: r.lien,
      audience: r.audience,
    };
    g.userIds.push(r.userId);
    groups.set(gKey, g);
  }

  for (const g of groups.values()) {
    const eventKey =
      params.kind === "ANNULATION_CONFIRMEE" && g.audience
        ? `note:${params.noteId}:annulation:${params.demandeId}:confirmee:${g.audience}`
        : buildNoteFraisReglementOutboxEventKey(
            params.kind,
            params.noteId,
            params.demandeId
          );

    for (const userId of g.userIds) {
      await tx.notification.create({
        data: {
          userId,
          type: TypeNotification.Action,
          titre,
          message,
          lien: g.lien,
          lue: false,
        },
      });
    }

    await tx.noteFraisOutboxEvent.create({
      data: {
        noteFraisId: params.noteId,
        eventKey,
        kind: params.kind,
        payload: {
          userIds: g.userIds,
          titre,
          message,
          lien: g.lien,
        },
        status: "PENDING",
      },
    });
  }
}
