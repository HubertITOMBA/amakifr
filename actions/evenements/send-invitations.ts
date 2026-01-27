"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { sendEventInvitationEmail } from "@/lib/mail";

export interface SendEventInvitationData {
  evenementId: string;
  userIds: string[] | null; // null = tous les membres, sinon liste d'IDs
  includeInactifs: boolean; // Si true, inclut les membres inactifs
}

/**
 * Envoyer des invitations par email pour un événement
 */
export async function sendEventInvitations(
  invitationData: SendEventInvitationData
): Promise<{ success: boolean; error?: string; sentCount?: number; failedCount?: number }> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Non authentifié" };
    }

    // Vérifier que l'utilisateur est admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id! },
      select: { role: true },
    });

    if (!user || user.role !== "ADMIN") {
      return { success: false, error: "Accès non autorisé. Administrateur requis." };
    }

    // Validation
    if (!invitationData.evenementId) {
      return { success: false, error: "L'ID de l'événement est requis" };
    }

    // Récupérer l'événement
    const evenement = await prisma.evenement.findUnique({
      where: { id: invitationData.evenementId },
    });

    if (!evenement) {
      return { success: false, error: "Événement non trouvé" };
    }

    // Récupérer les utilisateurs à inviter
    let users;
    if (invitationData.userIds === null) {
      // Tous les membres
      const whereClause: any = {
        role: { in: ["MEMBRE", "ADMIN"] },
      };

      if (!invitationData.includeInactifs) {
        whereClause.status = "Actif";
      }

      users = await prisma.user.findMany({
        where: whereClause,
        include: {
          adherent: {
            select: {
              firstname: true,
              lastname: true,
              civility: true,
            },
          },
        },
      });
    } else {
      // Utilisateurs spécifiques
      users = await prisma.user.findMany({
        where: {
          id: { in: invitationData.userIds },
        },
        include: {
          adherent: {
            select: {
              firstname: true,
              lastname: true,
              civility: true,
            },
          },
        },
      });
    }

    if (users.length === 0) {
      return { success: false, error: "Aucun utilisateur trouvé" };
    }

    // Filtrer les utilisateurs avec email valide
    const usersWithEmail = users.filter((u) => u.email && u.email.trim().length > 0);

    if (usersWithEmail.length === 0) {
      return { success: false, error: "Aucun utilisateur avec adresse email valide" };
    }

    // Envoyer les invitations
    let sentCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < usersWithEmail.length; i++) {
      const user = usersWithEmail[i];
      try {
        const userName = user.adherent
          ? `${user.adherent.civility || ""} ${user.adherent.firstname || ""} ${user.adherent.lastname || ""}`.trim() || user.name || "Adhérent"
          : user.name || "Adhérent";

        await sendEventInvitationEmail(
          user.email!,
          userName,
          evenement.titre,
          evenement.description || "",
          evenement.dateDebut,
          evenement.dateFin || null,
          evenement.lieu || null,
          evenement.adresse || null
        );
        sentCount++;
        
        // Attendre 2 secondes avant d'envoyer le prochain email (sauf pour le dernier)
        // Pour éviter l'erreur 429 (rate limit: 2 requêtes par seconde)
        // 2 secondes = 0.5 requête/seconde, bien en dessous de la limite
        if (i < usersWithEmail.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error: any) {
        failedCount++;
        const errorMsg = `Erreur pour ${user.email}: ${error.message || "Erreur inconnue"}`;
        errors.push(errorMsg);
        console.error(errorMsg, error);
        
        // Attendre quand même 2 secondes même en cas d'erreur pour éviter le rate limit
        if (i < usersWithEmail.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    if (sentCount === 0) {
      return {
        success: false,
        error: `Aucune invitation n'a pu être envoyée. ${errors.join("; ")}`,
        sentCount: 0,
        failedCount,
      };
    }

    return {
      success: true,
      sentCount,
      failedCount,
    };
  } catch (error: any) {
    console.error("Erreur lors de l'envoi des invitations:", error);
    return {
      success: false,
      error: error.message || "Erreur lors de l'envoi des invitations",
    };
  }
}

/**
 * Récupérer tous les utilisateurs éligibles pour l'invitation
 */
export async function getEligibleUsersForInvitation(includeInactifs: boolean = false) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Non authentifié" };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id! },
      select: { role: true },
    });

    if (!user || user.role !== "ADMIN") {
      return { success: false, error: "Accès non autorisé" };
    }

    const whereClause: any = {
      role: { in: ["MEMBRE", "ADMIN"] },
    };

    if (!includeInactifs) {
      whereClause.status = "Actif";
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        adherent: {
          select: {
            firstname: true,
            lastname: true,
            civility: true,
          },
        },
      },
      orderBy: [
        { adherent: { lastname: "asc" } },
        { adherent: { firstname: "asc" } },
      ],
    });

    return {
      success: true,
      users: users.map((u) => ({
        id: u.id,
        name: u.adherent
          ? `${u.adherent.civility || ""} ${u.adherent.firstname || ""} ${u.adherent.lastname || ""}`.trim() || u.name || "Sans nom"
          : u.name || "Sans nom",
        email: u.email,
        status: u.status,
      })),
    };
  } catch (error: any) {
    console.error("Erreur lors de la récupération des utilisateurs:", error);
    return {
      success: false,
      error: error.message || "Erreur lors de la récupération des utilisateurs",
    };
  }
}

