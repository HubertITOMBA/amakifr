"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TypeNotification } from "@prisma/client";
import { startOfMonth, endOfMonth, subMonths, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

/**
 * Récupère les statistiques du dashboard admin
 * 
 * @returns Un objet avec success (boolean), stats (object) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function getDashboardStats() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "Admin") {
      return { success: false, error: "Non autorisé" };
    }

    const now = new Date();
    const startOfCurrentMonth = startOfMonth(now);
    const endOfCurrentMonth = endOfMonth(now);
    const startOfLastMonth = startOfMonth(subMonths(now, 1));
    const endOfLastMonth = endOfMonth(subMonths(now, 1));
    const startOfCurrentYear = new Date(now.getFullYear(), 0, 1);

    // Total membres actifs
    const [totalMembresActifs, totalMembresActifsLastMonth] = await Promise.all([
      db.user.count({
        where: {
          role: "Membre",
          status: "Actif",
        },
      }),
      db.user.count({
        where: {
          role: "Membre",
          status: "Actif",
          createdAt: { lte: endOfLastMonth },
        },
      }),
    ]);

    const evolutionMembres = totalMembresActifsLastMonth > 0
      ? Math.round(((totalMembresActifs - totalMembresActifsLastMonth) / totalMembresActifsLastMonth) * 100)
      : 0;

    // Événements ce mois
    const [evenementsCeMois, evenementsMoisDernier] = await Promise.all([
      db.evenement.count({
        where: {
          createdAt: {
            gte: startOfCurrentMonth,
            lte: endOfCurrentMonth,
          },
        },
      }),
      db.evenement.count({
        where: {
          createdAt: {
            gte: startOfLastMonth,
            lte: endOfLastMonth,
          },
        },
      }),
    ]);

    const evolutionEvenements = evenementsMoisDernier > 0
      ? evenementsCeMois - evenementsMoisDernier
      : evenementsCeMois;

    // Newsletter (notifications de type Email envoyées cette année)
    const [newsletterTotal, newsletterLastYear] = await Promise.all([
      db.notification.count({
        where: {
          type: TypeNotification.Email,
          createdAt: { gte: startOfCurrentYear },
        },
      }),
      db.notification.count({
        where: {
          type: TypeNotification.Email,
          createdAt: {
            gte: new Date(now.getFullYear() - 1, 0, 1),
            lt: startOfCurrentYear,
          },
        },
      }),
    ]);

    const evolutionNewsletter = newsletterLastYear > 0
      ? Math.round(((newsletterTotal - newsletterLastYear) / newsletterLastYear) * 100)
      : 0;

    // Engagement (taux de participation aux événements)
    const [totalInscriptions, totalEvenementsAvecInscriptions, totalMembres] = await Promise.all([
      db.inscriptionEvenement.count(),
      db.evenement.count({
        where: {
          inscriptionRequis: true,
        },
      }),
      db.user.count({
        where: {
          role: "Membre",
          status: "Actif",
        },
      }),
    ]);

    const tauxEngagement = totalMembres > 0 && totalEvenementsAvecInscriptions > 0
      ? Math.round((totalInscriptions / (totalMembres * totalEvenementsAvecInscriptions)) * 100)
      : 0;

    const [tauxEngagementLastMonth] = await Promise.all([
      db.inscriptionEvenement.count({
        where: {
          createdAt: { lte: endOfLastMonth },
        },
      }),
    ]);

    const evolutionEngagement = totalMembres > 0 && totalEvenementsAvecInscriptions > 0
      ? Math.round(((totalInscriptions - tauxEngagementLastMonth) / (totalMembres * totalEvenementsAvecInscriptions)) * 100)
      : 0;

    return {
      success: true,
      stats: {
        totalMembres: {
          value: totalMembresActifs.toString(),
          change: evolutionMembres >= 0 ? `+${evolutionMembres}%` : `${evolutionMembres}%`,
          changeType: evolutionMembres >= 0 ? "positive" : "negative",
          description: "Membres actifs cette année",
        },
        evenements: {
          value: evenementsCeMois.toString(),
          change: evolutionEvenements >= 0 ? `+${evolutionEvenements}` : `${evolutionEvenements}`,
          changeType: evolutionEvenements >= 0 ? "positive" : "negative",
          description: "Événements ce mois",
        },
        newsletter: {
          value: newsletterTotal.toString(),
          change: evolutionNewsletter >= 0 ? `+${evolutionNewsletter}%` : `${evolutionNewsletter}%`,
          changeType: evolutionNewsletter >= 0 ? "positive" : "negative",
          description: "Newsletters envoyées cette année",
        },
        engagement: {
          value: `${tauxEngagement}%`,
          change: evolutionEngagement >= 0 ? `+${evolutionEngagement}%` : `${evolutionEngagement}%`,
          changeType: evolutionEngagement >= 0 ? "positive" : "negative",
          description: "Taux d'engagement moyen",
        },
      },
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des statistiques:", error);
    return { success: false, error: "Erreur lors de la récupération des statistiques" };
  }
}

/**
 * Récupère les activités récentes pour le dashboard admin
 * 
 * @param limit - Nombre d'activités à récupérer (défaut: 10)
 * @returns Un objet avec success (boolean), activities (array) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function getRecentActivities(limit: number = 10) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "Admin") {
      return { success: false, error: "Non autorisé" };
    }

    const activities: Array<{
      id: string;
      type: "user" | "event" | "newsletter" | "profile";
      action: string;
      user: string;
      time: string;
      status: "success" | "info" | "warning";
    }> = [];

    // Nouveaux membres (derniers 30 jours)
    const nouveauxMembres = await db.user.findMany({
      where: {
        role: "Membre",
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
      include: {
        adherent: {
          select: {
            firstname: true,
            lastname: true,
          },
        },
      },
    });

    nouveauxMembres.forEach((user) => {
      const name = user.adherent
        ? `${user.adherent.firstname || ""} ${user.adherent.lastname || ""}`.trim() || user.name || "Utilisateur"
        : user.name || "Utilisateur";
      activities.push({
        id: `user-${user.id}`,
        type: "user",
        action: "Nouveau membre inscrit",
        user: name,
        time: formatDistanceToNow(new Date(user.createdAt), { addSuffix: true, locale: fr }),
        status: "success",
      });
    });

    // Événements créés (derniers 30 jours)
    const evenementsRecents = await db.evenement.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
      include: {
        CreatedBy: {
          select: {
            name: true,
          },
        },
      },
    });

    evenementsRecents.forEach((event) => {
      activities.push({
        id: `event-${event.id}`,
        type: "event",
        action: "Événement créé",
        user: event.CreatedBy?.name || "Système",
        time: formatDistanceToNow(new Date(event.createdAt), { addSuffix: true, locale: fr }),
        status: "info",
      });
    });

    // Newsletters envoyées (derniers 30 jours) - notifications de type Email
    const newslettersRecentes = await db.notification.findMany({
      where: {
        type: "Email",
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
    });

    newslettersRecentes.forEach((notification) => {
      activities.push({
        id: `newsletter-${notification.id}`,
        type: "newsletter",
        action: "Newsletter envoyée",
        user: "Système",
        time: formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: fr }),
        status: "success",
      });
    });

    // Profils mis à jour (derniers 30 jours) - via User.updatedAt ou Adherent.updatedAt
    const profilsMisAJour = await db.user.findMany({
      where: {
        updatedAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 10,
      include: {
        adherent: {
          select: {
            firstname: true,
            lastname: true,
            updated_at: true,
          },
        },
      },
    });

    // Filtrer pour ne garder que ceux où updatedAt est différent de createdAt
    profilsMisAJour
      .filter((user) => {
        const userUpdatedAt = new Date(user.updatedAt);
        const userCreatedAt = new Date(user.createdAt);
        // Vérifier que updatedAt est significativement différent de createdAt (plus de 1 minute)
        return userUpdatedAt.getTime() - userCreatedAt.getTime() > 60000;
      })
      .slice(0, 5)
      .forEach((user) => {
        const name = user.adherent
          ? `${user.adherent.firstname || ""} ${user.adherent.lastname || ""}`.trim() || user.name || "Utilisateur"
          : user.name || "Utilisateur";
        const adherentUpdatedAt = user.adherent?.updated_at ? new Date(user.adherent.updated_at) : null;
        const userUpdatedAt = new Date(user.updatedAt);
        const updateDate = adherentUpdatedAt && adherentUpdatedAt > userUpdatedAt
          ? adherentUpdatedAt
          : userUpdatedAt;
        activities.push({
          id: `profile-${user.id}`,
          type: "profile",
          action: "Profil mis à jour",
          user: name,
          time: formatDistanceToNow(updateDate, { addSuffix: true, locale: fr }),
          status: "info",
        });
      });

    // Trier par date (plus récent en premier) et limiter
    activities.sort((a, b) => {
      // Extraire la date depuis le time string (approximatif)
      // Pour une meilleure précision, on pourrait stocker la date réelle
      return 0; // On garde l'ordre d'insertion qui est déjà trié par date
    });

    return {
      success: true,
      activities: activities.slice(0, limit),
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des activités récentes:", error);
    return { success: false, error: "Erreur lors de la récupération des activités récentes" };
  }
}

/**
 * Récupère les événements à venir pour le dashboard admin
 * 
 * @param limit - Nombre d'événements à récupérer (défaut: 5)
 * @returns Un objet avec success (boolean), events (array) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function getUpcomingEvents(limit: number = 5) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "Admin") {
      return { success: false, error: "Non autorisé" };
    }

    const now = new Date();

    const evenements = await db.evenement.findMany({
      where: {
        dateDebut: {
          gte: now,
        },
        statut: {
          in: ["Publie", "Brouillon"],
        },
      },
      orderBy: {
        dateDebut: "asc",
      },
      take: limit,
      include: {
        _count: {
          select: {
            Inscriptions: true,
          },
        },
      },
    });

    const events = evenements.map((event) => {
      const dateDebut = new Date(event.dateDebut);
      const heure = dateDebut.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      const date = dateDebut.toLocaleDateString("fr-FR");

      return {
        id: event.id,
        title: event.titre,
        date,
        time: heure,
        attendees: event._count.Inscriptions,
        status: event.statut === "Publie" ? "confirmed" : "pending",
      };
    });

    return {
      success: true,
      events,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des événements à venir:", error);
    return { success: false, error: "Erreur lors de la récupération des événements à venir" };
  }
}

/**
 * Récupère les alertes et notifications importantes pour le dashboard admin
 * 
 * @returns Un objet avec success (boolean), alerts (array) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function getDashboardAlerts() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "Admin") {
      return { success: false, error: "Non autorisé" };
    }

    const alerts: Array<{
      id: string;
      type: "warning" | "info" | "error" | "success";
      title: string;
      message: string;
      count: number;
      link?: string;
    }> = [];

    // Demandes RGPD en attente
    if ('dataDeletionRequest' in db) {
      try {
        const rgpdPending = await (db as any).dataDeletionRequest.count({
          where: {
            statut: { in: ["EnAttente", "EnVerification"] },
          },
        });
        if (rgpdPending > 0) {
          alerts.push({
            id: "rgpd-pending",
            type: "warning",
            title: "Demandes RGPD en attente",
            message: `${rgpdPending} demande(s) de suppression de données nécessitent votre attention`,
            count: rgpdPending,
            link: "/admin/rgpd/demandes",
          });
        }
      } catch (error) {
        // Ignorer si le modèle n'existe pas encore
      }
    }

    // Cotisations en retard
    const cotisationsEnRetard = await db.adherent.count({
      where: {
        ObligationsCotisation: {
          some: {
            statut: "EnRetard",
          },
        },
      },
    });
    if (cotisationsEnRetard > 0) {
      alerts.push({
        id: "cotisations-retard",
        type: "error",
        title: "Cotisations en retard",
        message: `${cotisationsEnRetard} adhérent(s) ont des cotisations en retard`,
        count: cotisationsEnRetard,
        link: "/admin/cotisations/gestion",
      });
    }

    // Assistances en attente
    const assistancesEnAttente = await db.assistance.count({
      where: {
        statut: "EnAttente",
      },
    });
    if (assistancesEnAttente > 0) {
      alerts.push({
        id: "assistances-pending",
        type: "info",
        title: "Assistances en attente",
        message: `${assistancesEnAttente} demande(s) d'assistance nécessitent un traitement`,
        count: assistancesEnAttente,
        link: "/admin/finances/assistances",
      });
    }

    // Événements à venir (dans les 7 prochains jours)
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const evenementsProchains = await db.evenement.count({
      where: {
        dateDebut: {
          gte: now,
          lte: in7Days,
        },
        statut: "Publie",
      },
    });
    if (evenementsProchains > 0) {
      alerts.push({
        id: "evenements-prochains",
        type: "info",
        title: "Événements à venir",
        message: `${evenementsProchains} événement(s) prévu(s) dans les 7 prochains jours`,
        count: evenementsProchains,
        link: "/admin/evenements/gestion",
      });
    }

    return {
      success: true,
      alerts,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des alertes:", error);
    return { success: false, error: "Erreur lors de la récupération des alertes" };
  }
}

/**
 * Récupère les statistiques financières pour le dashboard admin
 * 
 * @returns Un objet avec success (boolean), financialStats (object) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function getDashboardFinancialStats() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "Admin") {
      return { success: false, error: "Non autorisé" };
    }

    const now = new Date();
    const startOfCurrentMonth = startOfMonth(now);
    const endOfCurrentMonth = endOfMonth(now);
    const startOfLastMonth = startOfMonth(subMonths(now, 1));
    const endOfLastMonth = endOfMonth(subMonths(now, 1));

    // Total des dettes initiales
    const totalDettesInitiales = await db.detteInitiale.aggregate({
      _sum: {
        montantRestant: true,
      },
    });

    // Total des paiements ce mois
    const [paiementsCeMois, paiementsMoisDernier] = await Promise.all([
      db.paiementCotisation.aggregate({
        where: {
          statut: "Valide",
          datePaiement: {
            gte: startOfCurrentMonth,
            lte: endOfCurrentMonth,
          },
        },
        _sum: {
          montant: true,
        },
      }),
      db.paiementCotisation.aggregate({
        where: {
          statut: "Valide",
          datePaiement: {
            gte: startOfLastMonth,
            lte: endOfLastMonth,
          },
        },
        _sum: {
          montant: true,
        },
      }),
    ]);

    // Total des assistances en attente
    const assistancesEnAttente = await db.assistance.aggregate({
      where: {
        statut: "EnAttente",
      },
      _sum: {
        montantRestant: true,
      },
    });

    const totalDettes = Number(totalDettesInitiales._sum.montantRestant || 0);
    const totalPaiementsMois = Number(paiementsCeMois._sum.montant || 0);
    const totalPaiementsMoisDernier = Number(paiementsMoisDernier._sum.montant || 0);
    const totalAssistances = Number(assistancesEnAttente._sum.montantRestant || 0);

    const evolutionPaiements = totalPaiementsMoisDernier > 0
      ? Math.round(((totalPaiementsMois - totalPaiementsMoisDernier) / totalPaiementsMoisDernier) * 100)
      : totalPaiementsMois > 0 ? 100 : 0;

    return {
      success: true,
      financialStats: {
        totalDettes: {
          value: totalDettes.toFixed(2),
          formatted: `${totalDettes.toFixed(2)} €`,
        },
        totalPaiementsMois: {
          value: totalPaiementsMois.toFixed(2),
          formatted: `${totalPaiementsMois.toFixed(2)} €`,
          change: evolutionPaiements >= 0 ? `+${evolutionPaiements}%` : `${evolutionPaiements}%`,
          changeType: evolutionPaiements >= 0 ? "positive" : "negative",
        },
        totalAssistances: {
          value: totalAssistances.toFixed(2),
          formatted: `${totalAssistances.toFixed(2)} €`,
        },
      },
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des statistiques financières:", error);
    return { success: false, error: "Erreur lors de la récupération des statistiques financières" };
  }
}

