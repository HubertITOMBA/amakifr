import { db } from "@/lib/db";
import { sendSondageInvitationEmail } from "@/lib/mail";
import { pushAfterInternalNotifications } from "@/lib/services/notifications/push-after-internal-notification";
import { UserRole, UserStatus, TypeNotification } from "@prisma/client";
import { sondageKindLabel } from "@/lib/sondages";

const EMAIL_DELAY_MS = 2000;

export type SondageNotificationResult = {
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  errors: string[];
};

export type SondageInAppNotifyResult = {
  createdCount: number;
  skippedDuplicateCount: number;
  skippedIneligibleCount: number;
  recipientUserIds: string[];
};

type SondageForNotification = {
  id: string;
  sujet: string;
  introduction: string | null;
  dateDebut: Date;
  dateFin: Date;
  kind?: string;
};

export type SondageNotifyDeps = {
  listEligibleUserIds?: () => Promise<string[]>;
  findExistingLiens?: (
    userIds: string[],
    lien: string
  ) => Promise<Set<string>>;
  createNotifications?: (args: {
    userIds: string[];
    titre: string;
    message: string;
    lien: string;
    type: TypeNotification;
  }) => Promise<number>;
  pushAfter?: typeof pushAfterInternalNotifications;
};

/**
 * Lien canonique notification → questionnaire (Web / mobile).
 */
export function sondageNotificationLien(sondageId: string): string {
  return `/sondages/${sondageId}`;
}

/**
 * Adhérents actifs (MEMBRE|ADMIN avec fiche adhérent) — public des questionnaires.
 */
export async function getActiveAdherentsWithEmail() {
  const users = await db.user.findMany({
    where: {
      role: { in: [UserRole.MEMBRE, UserRole.ADMIN] },
      status: UserStatus.Actif,
      adherent: { isNot: null },
    },
    select: {
      id: true,
      email: true,
      name: true,
      adherent: {
        select: {
          firstname: true,
          lastname: true,
          civility: true,
        },
      },
    },
  });

  return users.filter((user) => user.email && user.email.trim().length > 0);
}

/**
 * Identifiants utilisateurs éligibles à la notif in-app / push (actifs + adhérent).
 */
export async function listSondageNotifyEligibleUserIds(): Promise<string[]> {
  const users = await db.user.findMany({
    where: {
      role: { in: [UserRole.MEMBRE, UserRole.ADMIN] },
      status: UserStatus.Actif,
      adherent: { isNot: null },
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

function formatUserName(user: {
  name: string | null;
  adherent: {
    firstname: string;
    lastname: string;
    civility: string | null;
  } | null;
}): string {
  if (user.adherent) {
    const full =
      `${user.adherent.civility || ""} ${user.adherent.firstname} ${user.adherent.lastname}`.trim();
    if (full) return full;
  }
  return user.name?.trim() || "Adhérent";
}

/**
 * Envoie l'invitation email au sondage/quiz à tous les adhérents actifs.
 * (Canal email distinct de la notification in-app / push.)
 */
export async function sendSondageInvitationsToActiveAdherents(
  sondage: SondageForNotification
): Promise<SondageNotificationResult> {
  const users = await getActiveAdherentsWithEmail();
  const result: SondageNotificationResult = {
    sentCount: 0,
    failedCount: 0,
    skippedCount: 0,
    errors: [],
  };

  if (users.length === 0) {
    return result;
  }

  const sondageUrl = `${process.env.NEXT_PUBLIC_APP_URL || ""}/sondages/${sondage.id}`.replace(
    ":9050",
    ""
  );

  for (let i = 0; i < users.length; i++) {
    const user = users[i]!;
    try {
      const sent = await sendSondageInvitationEmail({
        email: user.email!,
        userName: formatUserName(user),
        sondageSujet: sondage.sujet,
        sondageIntroduction: sondage.introduction,
        dateDebut: sondage.dateDebut,
        dateFin: sondage.dateFin,
        sondageUrl,
      });

      if (sent) {
        result.sentCount++;
      } else {
        result.failedCount++;
        result.errors.push(`Échec pour ${user.email}`);
      }
    } catch (error) {
      result.failedCount++;
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      result.errors.push(`Erreur pour ${user.email}: ${message}`);
      console.error(`Erreur envoi sondage à ${user.email}:`, error);
    }

    if (i < users.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, EMAIL_DELAY_MS));
    }
  }

  return result;
}

/**
 * Notification in-app + push à la première publication.
 * Déduplique par lien `/sondages/:id` (republication / questions suivantes = 0 doublon).
 *
 * @param sondage - Campagne publiée (kind optionnel pour libellé)
 * @param deps - Injectables pour tests (destinataires fictifs, push simulé)
 */
export async function notifySondagePublishedInApp(
  sondage: SondageForNotification,
  deps: SondageNotifyDeps = {}
): Promise<SondageInAppNotifyResult> {
  const lien = sondageNotificationLien(sondage.id);
  const kindLabel = sondageKindLabel(sondage.kind);
  const titre = `${kindLabel} publié`;
  const message = `${kindLabel} : « ${sondage.sujet} ». Ouvrez pour participer.`;

  const listEligible =
    deps.listEligibleUserIds ?? listSondageNotifyEligibleUserIds;
  const eligibleIds = await listEligible();

  if (eligibleIds.length === 0) {
    return {
      createdCount: 0,
      skippedDuplicateCount: 0,
      skippedIneligibleCount: 0,
      recipientUserIds: [],
    };
  }

  const findExisting =
    deps.findExistingLiens ??
    (async (userIds: string[], link: string) => {
      const existing = await db.notification.findMany({
        where: {
          userId: { in: userIds },
          lien: link,
        },
        select: { userId: true },
      });
      return new Set(existing.map((n) => n.userId));
    });

  const already = await findExisting(eligibleIds, lien);
  const toCreate = eligibleIds.filter((id) => !already.has(id));

  if (toCreate.length === 0) {
    return {
      createdCount: 0,
      skippedDuplicateCount: already.size,
      skippedIneligibleCount: 0,
      recipientUserIds: [],
    };
  }

  const createMany =
    deps.createNotifications ??
    (async (args) => {
      const res = await db.notification.createMany({
        data: args.userIds.map((userId) => ({
          userId,
          type: args.type,
          titre: args.titre,
          message: args.message,
          lien: args.lien,
          lue: false,
        })),
      });
      return res.count;
    });

  const createdCount = await createMany({
    userIds: toCreate,
    titre,
    message,
    lien,
    type: TypeNotification.Systeme,
  });

  const push =
    deps.pushAfter ?? pushAfterInternalNotifications;
  void push(toCreate, { titre, message, lien }).catch(() => {
    /* best-effort */
  });

  return {
    createdCount,
    skippedDuplicateCount: already.size,
    skippedIneligibleCount: 0,
    recipientUserIds: toCreate,
  };
}
