import { db } from "@/lib/db";
import { sendSondageInvitationEmail } from "@/lib/mail";
import { UserRole, UserStatus } from "@prisma/client";

const EMAIL_DELAY_MS = 2000;

export type SondageNotificationResult = {
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  errors: string[];
};

type SondageForNotification = {
  id: string;
  sujet: string;
  introduction: string | null;
  dateDebut: Date;
  dateFin: Date;
};

/**
 * Récupère les utilisateurs adhérents actifs avec une adresse email valide.
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

function formatUserName(user: {
  name: string | null;
  adherent: {
    firstname: string;
    lastname: string;
    civility: string | null;
  } | null;
}): string {
  if (user.adherent) {
    const full = `${user.adherent.civility || ""} ${user.adherent.firstname} ${user.adherent.lastname}`.trim();
    if (full) return full;
  }
  return user.name?.trim() || "Adhérent";
}

/**
 * Envoie l'invitation au sondage à tous les adhérents actifs.
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
    result.skippedCount = 0;
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
