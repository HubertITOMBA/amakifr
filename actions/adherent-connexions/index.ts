"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { canRead } from "@/lib/dynamic-permissions";
import {
  getConnexionBadgeTier,
  isConnexionBadgeCondition,
} from "@/lib/adherent-connexions-badges";

export type AdherentConnexionRow = {
  userId: string;
  adherentId: string;
  firstname: string;
  lastname: string;
  civility: string | null;
  email: string | null;
  loginCount: number;
  lastLogin: string | null;
  badgeNom: string | null;
  badgeCouleur: string | null;
  badgeIcone: string | null;
};

/**
 * Récupère la liste des adhérents (hors ADMIN) avec leurs statistiques de connexion
 *
 * @returns Liste des adhérents avec nombre de connexions, dernière connexion et badge de fidélité portail
 */
export async function getAdherentConnexionsList(): Promise<{
  success: boolean;
  data?: AdherentConnexionRow[];
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const hasAccess = await canRead(session.user.id, "getAdherentConnexionsList");
    if (!hasAccess) {
      return { success: false, error: "Non autorisé" };
    }

    const users = await prisma.user.findMany({
      where: {
        role: { not: UserRole.ADMIN },
        adherent: { isNot: null },
      },
      select: {
        id: true,
        email: true,
        loginCount: true,
        lastLogin: true,
        adherent: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
            civility: true,
          },
        },
        badgesAttribues: {
          include: {
            Badge: {
              select: {
                nom: true,
                couleur: true,
                icone: true,
                condition: true,
                ordre: true,
              },
            },
          },
        },
      },
      orderBy: [{ loginCount: "desc" }, { lastLogin: "desc" }],
    });

    const data: AdherentConnexionRow[] = users
      .filter((u) => u.adherent)
      .map((u) => {
        const adherent = u.adherent!;
        const connexionBadges = u.badgesAttribues
          .filter((a) => isConnexionBadgeCondition(a.Badge.condition))
          .sort((a, b) => (b.Badge.ordre ?? 0) - (a.Badge.ordre ?? 0));

        const attributed = connexionBadges[0]?.Badge;
        const tier = getConnexionBadgeTier(u.loginCount);

        return {
          userId: u.id,
          adherentId: adherent.id,
          firstname: adherent.firstname,
          lastname: adherent.lastname,
          civility: adherent.civility,
          email: u.email,
          loginCount: u.loginCount,
          lastLogin: u.lastLogin?.toISOString() ?? null,
          badgeNom: attributed?.nom ?? tier?.nom ?? null,
          badgeCouleur: attributed?.couleur ?? tier?.couleur ?? null,
          badgeIcone: attributed?.icone ?? "Award",
        };
      });

    return { success: true, data };
  } catch (error) {
    console.error("Erreur getAdherentConnexionsList:", error);
    return {
      success: false,
      error: "Erreur lors du chargement des connexions adhérents",
    };
  }
}

/**
 * Synchronise les badges de connexion pour tous les adhérents non ADMIN
 */
export async function syncConnexionBadgesForAll(): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const hasAccess = await canRead(session.user.id, "getAdherentConnexionsList");
    if (!hasAccess) {
      return { success: false, error: "Non autorisé" };
    }

    const { verifierBadgesAutomatiques } = await import("@/actions/badges");

    const users = await prisma.user.findMany({
      where: {
        role: { not: UserRole.ADMIN },
        adherent: { isNot: null },
      },
      select: { id: true },
    });

    let total = 0;
    for (const u of users) {
      const result = await verifierBadgesAutomatiques(u.id);
      if (result.success && result.data?.badgesAttribues) {
        total += result.data.badgesAttribues;
      }
    }

    return {
      success: true,
      message: `${total} badge(s) de connexion attribué(s) ou mis à jour`,
    };
  } catch (error) {
    console.error("Erreur syncConnexionBadgesForAll:", error);
    return { success: false, error: "Erreur lors de la synchronisation des badges" };
  }
}
