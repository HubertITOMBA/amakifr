"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear, format } from "date-fns";

/**
 * Helper pour gérer l'absence de table dans Prisma
 * Retourne 0 si la table n'existe pas (code P2021)
 */
async function safeCount(query: Promise<number>): Promise<number> {
  try {
    return await query;
  } catch (error: any) {
    // Si la table n'existe pas (code P2021 pour Prisma)
    if (error?.code === 'P2021') {
      return 0;
    }
    throw error;
  }
}

/**
 * Helper pour gérer l'absence de table dans Prisma pour aggregate
 * Retourne un objet avec _sum: { montant: 0 } si la table n'existe pas
 */
async function safeAggregate<T extends { _sum: { montant?: any } }>(
  query: Promise<T>
): Promise<T> {
  try {
    return await query;
  } catch (error: any) {
    // Si la table n'existe pas (code P2021 pour Prisma)
    if (error?.code === 'P2021') {
      return { _sum: { montant: 0 } } as T;
    }
    throw error;
  }
}

/**
 * Récupère toutes les statistiques analytiques pour le dashboard
 */
export async function getAnalyticsDashboard(period: "week" | "month" | "quarter" | "year" = "month") {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const now = new Date();
    let startDate: Date;
    let previousStartDate: Date;

    switch (period) {
      case "week":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        previousStartDate = new Date(startDate);
        previousStartDate.setDate(previousStartDate.getDate() - 7);
        break;
      case "month":
        startDate = startOfMonth(now);
        previousStartDate = startOfMonth(subMonths(now, 1));
        break;
      case "quarter":
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        previousStartDate = new Date(now.getFullYear(), (quarter - 1) * 3, 1);
        break;
      case "year":
        startDate = startOfYear(now);
        previousStartDate = startOfYear(subMonths(now, 12));
        break;
    }

    const endDate = period === "week" ? now : endOfMonth(now);
    const previousEndDate = period === "week" 
      ? new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000)
      : endOfMonth(previousStartDate);

    // Récupérer toutes les statistiques en parallèle
    const [
      adherentsStats,
      evenementsStats,
      cotisationsStats,
      financesStats,
      ideesStats,
      documentsStats,
      electionsStats,
      engagementStats,
      topEvenements,
      alertes,
      evolutionAdherents,
      evolutionEvenements,
      evolutionCotisations,
      evolutionFinances,
    ] = await Promise.all([
      getAdherentsStats(startDate, endDate, previousStartDate, previousEndDate),
      getEvenementsStats(startDate, endDate, previousStartDate, previousEndDate),
      getCotisationsStats(startDate, endDate, previousStartDate, previousEndDate),
      getFinancesStats(startDate, endDate, previousStartDate, previousEndDate),
      getIdeesStats(startDate, endDate, previousStartDate, previousEndDate),
      getDocumentsStats(startDate, endDate, previousStartDate, previousEndDate),
      getElectionsStats(startDate, endDate, previousStartDate, previousEndDate),
      getEngagementStats(startDate, endDate),
      getTopEvenements(5),
      getAlertes(),
      getEvolutionAdherents(12),
      getEvolutionEvenements(12),
      getEvolutionCotisations(12),
      getEvolutionFinances(12),
    ]);

    return {
      success: true,
      data: {
        period,
        adherents: adherentsStats,
        evenements: evenementsStats,
        cotisations: cotisationsStats,
        finances: financesStats,
        idees: ideesStats,
        documents: documentsStats,
        elections: electionsStats,
        engagement: engagementStats,
        topEvenements,
        alertes,
        evolutions: {
          adherents: evolutionAdherents,
          evenements: evolutionEvenements,
          cotisations: evolutionCotisations,
          finances: evolutionFinances,
        },
      },
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des analytics:", error);
    return { success: false, error: "Erreur lors de la récupération des analytics" };
  }
}

/**
 * Statistiques des adhérents
 */
async function getAdherentsStats(
  startDate: Date,
  endDate: Date,
  previousStartDate: Date,
  previousEndDate: Date
) {
  const [totalActifs, totalInactifs, nouveaux, anciens] = await Promise.all([
    prisma.user.count({
      where: { status: "Actif", role: "Membre" },
    }),
    prisma.user.count({
      where: { status: "Inactif", role: "Membre" },
    }),
    prisma.user.count({
      where: {
        role: "Membre",
        createdAt: { gte: startDate, lte: endDate },
      },
    }),
    prisma.user.count({
      where: {
        role: "Membre",
        createdAt: { gte: previousStartDate, lte: previousEndDate },
      },
    }),
  ]);

  const evolution = anciens > 0 ? ((nouveaux - anciens) / anciens) * 100 : 0;

  return {
    totalActifs,
    totalInactifs,
    total: totalActifs + totalInactifs,
    nouveaux,
    evolution: Number(evolution.toFixed(1)),
  };
}

/**
 * Statistiques des événements
 */
async function getEvenementsStats(
  startDate: Date,
  endDate: Date,
  previousStartDate: Date,
  previousEndDate: Date
) {
  const [total, publies, totalInscriptions, evenementsPeriode, evenementsPeriodePrecedente] = await Promise.all([
    prisma.evenement.count(),
    prisma.evenement.count({ where: { statut: "Publie" } }),
    prisma.inscriptionEvenement.count(),
    prisma.evenement.count({
      where: {
        dateDebut: { gte: startDate, lte: endDate },
      },
    }),
    prisma.evenement.count({
      where: {
        dateDebut: { gte: previousStartDate, lte: previousEndDate },
      },
    }),
  ]);

  const evolution = evenementsPeriodePrecedente > 0
    ? ((evenementsPeriode - evenementsPeriodePrecedente) / evenementsPeriodePrecedente) * 100
    : 0;

  const tauxParticipation = total > 0 ? (totalInscriptions / total) * 100 : 0;

  return {
    total,
    publies,
    totalInscriptions,
    tauxParticipation: Number(tauxParticipation.toFixed(1)),
    evenementsPeriode,
    evolution: Number(evolution.toFixed(1)),
  };
}

/**
 * Statistiques des cotisations
 */
async function getCotisationsStats(
  startDate: Date,
  endDate: Date,
  previousStartDate: Date,
  previousEndDate: Date
) {
  const [adherentsAjour, adherentsEnRetard, totalDettes, cotisationsPeriode, cotisationsPeriodePrecedente] = await Promise.all([
    safeCount(prisma.adherent.count({
      where: {
        ObligationsCotisation: {
          none: {
            statut: { in: ["EnAttente", "PartiellementPaye", "EnRetard"] },
          },
        },
      },
    })),
    safeCount(prisma.adherent.count({
      where: {
        ObligationsCotisation: {
          some: {
            statut: "EnRetard",
          },
        },
      },
    })),
    safeAggregate(prisma.obligationCotisation.aggregate({
      where: {
        statut: { in: ["EnAttente", "PartiellementPaye", "EnRetard"] },
      },
      _sum: {
        montantRestant: true,
      },
    })),
    safeCount(prisma.cotisation.count({
      where: {
        dateCotisation: { gte: startDate, lte: endDate },
      },
    })),
    safeCount(prisma.cotisation.count({
      where: {
        dateCotisation: { gte: previousStartDate, lte: previousEndDate },
      },
    })),
  ]);

  const evolution = cotisationsPeriodePrecedente > 0
    ? ((cotisationsPeriode - cotisationsPeriodePrecedente) / cotisationsPeriodePrecedente) * 100
    : 0;

  const tauxCotisation = adherentsAjour + adherentsEnRetard > 0
    ? (adherentsAjour / (adherentsAjour + adherentsEnRetard)) * 100
    : 0;

  return {
    adherentsAjour,
    adherentsEnRetard,
    totalDettes: Number(totalDettes._sum.montantRestant || 0),
    tauxCotisation: Number(tauxCotisation.toFixed(1)),
    cotisationsPeriode,
    evolution: Number(evolution.toFixed(1)),
  };
}

/**
 * Statistiques financières
 */
async function getFinancesStats(
  startDate: Date,
  endDate: Date,
  previousStartDate: Date,
  previousEndDate: Date
) {
  const [revenus, depenses, revenusPeriode, depensesPeriode, revenusPeriodePrecedente, depensesPeriodePrecedente] = await Promise.all([
    safeAggregate(prisma.paiementCotisation.aggregate({
      where: { statut: "Valide" },
      _sum: { montant: true },
    })),
    safeAggregate(prisma.depense.aggregate({
      where: { statut: "Valide" },
      _sum: { montant: true },
    })),
    safeAggregate(prisma.paiementCotisation.aggregate({
      where: {
        statut: "Valide",
        datePaiement: { gte: startDate, lte: endDate },
      },
      _sum: { montant: true },
    })),
    safeAggregate(prisma.depense.aggregate({
      where: {
        statut: "Valide",
        dateDepense: { gte: startDate, lte: endDate },
      },
      _sum: { montant: true },
    })),
    safeAggregate(prisma.paiementCotisation.aggregate({
      where: {
        statut: "Valide",
        datePaiement: { gte: previousStartDate, lte: previousEndDate },
      },
      _sum: { montant: true },
    })),
    safeAggregate(prisma.depense.aggregate({
      where: {
        statut: "Valide",
        dateDepense: { gte: previousStartDate, lte: previousEndDate },
      },
      _sum: { montant: true },
    })),
  ]);

  const totalRevenus = Number(revenus._sum.montant || 0);
  const totalDepenses = Number(depenses._sum.montant || 0);
  const revenusP = Number(revenusPeriode._sum.montant || 0);
  const depensesP = Number(depensesPeriode._sum.montant || 0);
  const revenusPP = Number(revenusPeriodePrecedente._sum.montant || 0);
  const depensesPP = Number(depensesPeriodePrecedente._sum.montant || 0);

  const evolutionRevenus = revenusPP > 0 ? ((revenusP - revenusPP) / revenusPP) * 100 : 0;
  const evolutionDepenses = depensesPP > 0 ? ((depensesP - depensesPP) / depensesPP) * 100 : 0;
  const solde = revenusP - depensesP;

  return {
    totalRevenus,
    totalDepenses,
    revenusPeriode: revenusP,
    depensesPeriode: depensesP,
    solde: Number(solde.toFixed(2)),
    evolutionRevenus: Number(evolutionRevenus.toFixed(1)),
    evolutionDepenses: Number(evolutionDepenses.toFixed(1)),
  };
}

/**
 * Statistiques des idées
 */
async function getIdeesStats(
  startDate: Date,
  endDate: Date,
  previousStartDate: Date,
  previousEndDate: Date
) {
  const [total, ideesPeriode, ideesPeriodePrecedente] = await Promise.all([
    safeCount(prisma.idee.count()),
    safeCount(prisma.idee.count({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
    })),
    safeCount(prisma.idee.count({
      where: {
        createdAt: { gte: previousStartDate, lte: previousEndDate },
      },
    })),
  ]);

  const evolution = ideesPeriodePrecedente > 0
    ? ((ideesPeriode - ideesPeriodePrecedente) / ideesPeriodePrecedente) * 100
    : 0;

  return {
    total,
    ideesPeriode,
    evolution: Number(evolution.toFixed(1)),
  };
}

/**
 * Statistiques des documents
 */
async function getDocumentsStats(
  startDate: Date,
  endDate: Date,
  previousStartDate: Date,
  previousEndDate: Date
) {
  const [total, documentsPeriode, documentsPeriodePrecedente] = await Promise.all([
    safeCount(prisma.document.count()),
    safeCount(prisma.document.count({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
    })),
    safeCount(prisma.document.count({
      where: {
        createdAt: { gte: previousStartDate, lte: previousEndDate },
      },
    })),
  ]);

  const evolution = documentsPeriodePrecedente > 0
    ? ((documentsPeriode - documentsPeriodePrecedente) / documentsPeriodePrecedente) * 100
    : 0;

  return {
    total,
    documentsPeriode,
    evolution: Number(evolution.toFixed(1)),
  };
}

/**
 * Statistiques des élections
 */
async function getElectionsStats(
  startDate: Date,
  endDate: Date,
  previousStartDate: Date,
  previousEndDate: Date
) {
  const [total, ouvertes, totalVotes, electionsPeriode, electionsPeriodePrecedente] = await Promise.all([
    safeCount(prisma.election.count()),
    safeCount(prisma.election.count({ where: { status: "Ouverte" } })),
    safeCount(prisma.vote.count()),
    safeCount(prisma.election.count({
      where: {
        dateOuverture: { gte: startDate, lte: endDate },
      },
    })),
    safeCount(prisma.election.count({
      where: {
        dateOuverture: { gte: previousStartDate, lte: previousEndDate },
      },
    })),
  ]);

  const evolution = electionsPeriodePrecedente > 0
    ? ((electionsPeriode - electionsPeriodePrecedente) / electionsPeriodePrecedente) * 100
    : 0;

  const tauxParticipation = total > 0 ? (totalVotes / total) * 100 : 0;

  return {
    total,
    ouvertes,
    totalVotes,
    tauxParticipation: Number(tauxParticipation.toFixed(1)),
    electionsPeriode,
    evolution: Number(evolution.toFixed(1)),
  };
}

/**
 * Statistiques d'engagement global
 */
async function getEngagementStats(startDate: Date, endDate: Date) {
  const [documentsUploades, votesEffectues, participationsEvenements, ideesSoumises] = await Promise.all([
    safeCount(prisma.document.count({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
    })),
    safeCount(prisma.vote.count({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
    })),
    safeCount(prisma.inscriptionEvenement.count({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
    })),
    safeCount(prisma.idee.count({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
    })),
  ]);

  const totalActions = documentsUploades + votesEffectues + participationsEvenements + ideesSoumises;

  return {
    documentsUploades,
    votesEffectues,
    participationsEvenements,
    ideesSoumises,
    totalActions,
  };
}

/**
 * Top événements les plus populaires
 */
async function getTopEvenements(limit: number = 5) {
  const evenements = await prisma.evenement.findMany({
    where: { statut: "Publie" },
    include: {
      _count: {
        select: {
          Inscriptions: true,
        },
      },
    },
    take: 50, // Prendre plus d'événements pour pouvoir trier
  });

  // Trier par nombre d'inscriptions (décroissant)
  const sorted = evenements.sort((a, b) => b._count.Inscriptions - a._count.Inscriptions);

  return sorted.slice(0, limit).map((e) => ({
    id: e.id,
    titre: e.titre,
    dateDebut: e.dateDebut,
    inscriptions: e._count.Inscriptions,
  }));
}

/**
 * Alertes automatiques
 */
async function getAlertes() {
  const now = new Date();
  const troisMoisAgo = subMonths(now, 3);

  const [adherentsRetard, evenementsPeuInscriptions, electionsLimite] = await Promise.all([
    prisma.adherent.findMany({
      where: {
        ObligationsCotisation: {
          some: {
            statut: "EnRetard",
            dateEcheance: { lte: troisMoisAgo },
          },
        },
      },
      select: {
        id: true,
        firstname: true,
        lastname: true,
      },
      take: 10,
    }),
    prisma.evenement.findMany({
      where: {
        statut: "Publie",
        dateDebut: { gte: now },
        inscriptionRequis: true,
      },
      include: {
        _count: {
          select: {
            Inscriptions: true,
          },
        },
      },
    }).then((events) =>
      events.filter((e) => e._count.Inscriptions < 5)
    ),
    prisma.election.findMany({
      where: {
        status: "Ouverte",
        dateClotureCandidature: {
          gte: now,
          lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 jours
        },
      },
      select: {
        id: true,
        titre: true,
        dateClotureCandidature: true,
      },
    }),
  ]);

  return {
    adherentsRetard: adherentsRetard.map((a) => ({
      id: a.id,
      nom: `${a.firstname} ${a.lastname}`,
    })),
    evenementsPeuInscriptions: evenementsPeuInscriptions.map((e) => ({
      id: e.id,
      titre: e.titre,
      inscriptions: e._count.Inscriptions,
    })),
    electionsLimite: electionsLimite.map((e) => ({
      id: e.id,
      titre: e.titre,
      dateLimite: e.dateClotureCandidature,
    })),
  };
}

/**
 * Évolution des adhérents sur N mois
 */
async function getEvolutionAdherents(months: number = 12) {
  const data = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = subMonths(now, i);
    const start = startOfMonth(date);
    const end = endOfMonth(date);

    const count = await prisma.user.count({
      where: {
        role: "Membre",
        createdAt: { lte: end },
      },
    });

    data.push({
      mois: format(start, "MMM yyyy"),
      date: start,
      total: count,
    });
  }

  return data;
}

/**
 * Évolution des événements sur N mois
 */
async function getEvolutionEvenements(months: number = 12) {
  const data = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = subMonths(now, i);
    const start = startOfMonth(date);
    const end = endOfMonth(date);

    const count = await safeCount(prisma.evenement.count({
      where: {
        dateDebut: { gte: start, lte: end },
      },
    }));

    data.push({
      mois: format(start, "MMM yyyy"),
      date: start,
      total: count,
    });
  }

  return data;
}

/**
 * Évolution des cotisations sur N mois
 */
async function getEvolutionCotisations(months: number = 12) {
  const data = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = subMonths(now, i);
    const start = startOfMonth(date);
    const end = endOfMonth(date);

    const result = await safeAggregate(prisma.cotisation.aggregate({
      where: {
        dateCotisation: { gte: start, lte: end },
        statut: "Valide",
      },
      _sum: {
        montant: true,
      },
    }));

    data.push({
      mois: format(start, "MMM yyyy"),
      date: start,
      montant: Number(result._sum.montant || 0),
    });
  }

  return data;
}

/**
 * Évolution des finances (revenus/dépenses) sur N mois
 */
async function getEvolutionFinances(months: number = 12) {
  const data = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = subMonths(now, i);
    const start = startOfMonth(date);
    const end = endOfMonth(date);

    const [revenus, depenses] = await Promise.all([
      safeAggregate(prisma.paiementCotisation.aggregate({
        where: {
          datePaiement: { gte: start, lte: end },
          statut: "Valide",
        },
        _sum: { montant: true },
      })),
      safeAggregate(prisma.depense.aggregate({
        where: {
          dateDepense: { gte: start, lte: end },
          statut: "Valide",
        },
        _sum: { montant: true },
      })),
    ]);

    data.push({
      mois: format(start, "MMM yyyy"),
      date: start,
      revenus: Number(revenus._sum.montant || 0),
      depenses: Number(depenses._sum.montant || 0),
    });
  }

  return data;
}

