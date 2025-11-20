"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { addMonths, isBefore, isAfter, format } from "date-fns";

/**
 * Récupère les membres actuels du bureau
 * Basé sur les élections clôturées et les candidats élus
 */
export async function getBureauActuel() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Récupérer la dernière élection clôturée
    const derniereElection = await prisma.election.findFirst({
      where: {
        status: "Cloturee",
      },
      include: {
        positions: {
          include: {
            PosteTemplate: {
              select: {
                libelle: true,
                ordre: true,
                description: true,
              },
            },
            candidacies: {
              where: {
                status: "Validee",
              },
              include: {
                adherent: {
                  include: {
                    User: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                      },
                    },
                  },
                },
                _count: {
                  select: {
                    votes: true,
                  },
                },
              },
            },
          },
          orderBy: [
            {
              PosteTemplate: {
                ordre: "asc",
              },
            },
            {
              titre: "asc",
            },
          ],
        },
      },
      orderBy: {
        dateCloture: "desc",
      },
    });

    if (!derniereElection) {
      return {
        success: true,
        data: {
          election: null,
          membres: [],
          message: "Aucune élection clôturée trouvée",
        },
      };
    }

    // Construire la liste des membres du bureau
    const membres: any[] = [];

    for (const position of derniereElection.positions) {
      // Trier les candidatures par nombre de votes (décroissant)
      const candidaturesTriees = [...position.candidacies].sort(
        (a, b) => b._count.votes - a._count.votes
      );

      // Prendre les N premiers (nombreMandats)
      const elus = candidaturesTriees.slice(0, position.nombreMandats);

      for (const candidat of elus) {
        const dateDebutMandat = derniereElection.dateCloture;
        const dateFinMandat = position.dureeMandat
          ? addMonths(dateDebutMandat, position.dureeMandat)
          : addMonths(dateDebutMandat, 24); // Par défaut 24 mois

        membres.push({
          id: candidat.id,
          poste: position.titre,
          posteType: position.type,
          posteOrdre: position.PosteTemplate?.ordre || 0,
          adherent: {
            id: candidat.adherent.id,
            prenom: candidat.adherent.firstname,
            nom: candidat.adherent.lastname,
            email: candidat.adherent.User?.email || "",
            image: candidat.adherent.User?.image || "",
            name: candidat.adherent.User?.name || "",
          },
          nombreVotes: candidat._count.votes,
          dateDebutMandat,
          dateFinMandat,
          dureeMandat: position.dureeMandat || 24,
          election: {
            id: derniereElection.id,
            titre: derniereElection.titre,
            dateCloture: derniereElection.dateCloture,
          },
        });
      }
    }

    // Trier par ordre du poste
    membres.sort((a, b) => a.posteOrdre - b.posteOrdre);

    return {
      success: true,
      data: {
        election: {
          id: derniereElection.id,
          titre: derniereElection.titre,
          dateCloture: derniereElection.dateCloture,
        },
        membres,
      },
    };
  } catch (error) {
    console.error("Erreur lors de la récupération du bureau:", error);
    return { success: false, error: "Erreur lors de la récupération du bureau" };
  }
}

/**
 * Récupère l'historique des mandats
 */
export async function getHistoriqueMandats() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const elections = await prisma.election.findMany({
      where: {
        status: "Cloturee",
      },
      include: {
        positions: {
          include: {
            PosteTemplate: {
              select: {
                libelle: true,
                ordre: true,
              },
            },
            candidacies: {
              where: {
                status: "Validee",
              },
              include: {
                adherent: {
                  include: {
                    User: {
                      select: {
                        name: true,
                        email: true,
                      },
                    },
                  },
                },
                _count: {
                  select: {
                    votes: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        dateCloture: "desc",
      },
    });

    const historique: any[] = [];

    for (const election of elections) {
      for (const position of election.positions) {
        const candidaturesTriees = [...position.candidacies].sort(
          (a, b) => b._count.votes - a._count.votes
        );
        const elus = candidaturesTriees.slice(0, position.nombreMandats);

        for (const candidat of elus) {
          const dateDebutMandat = election.dateCloture;
          const dateFinMandat = position.dureeMandat
            ? addMonths(dateDebutMandat, position.dureeMandat)
            : addMonths(dateDebutMandat, 24);

          historique.push({
            id: candidat.id,
            poste: position.titre,
            adherent: `${candidat.adherent.firstname} ${candidat.adherent.lastname}`,
            nombreVotes: candidat._count.votes,
            dateDebutMandat,
            dateFinMandat,
            election: election.titre,
            dateElection: election.dateCloture,
          });
        }
      }
    }

    return {
      success: true,
      data: historique,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération de l'historique:", error);
    return { success: false, error: "Erreur lors de la récupération de l'historique" };
  }
}

/**
 * Récupère les alertes de fin de mandat
 */
export async function getAlertesFinMandat() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const bureau = await getBureauActuel();
    if (!bureau.success || !bureau.data?.membres) {
      return { success: true, data: [] };
    }

    const now = new Date();
    const dateLimite = addMonths(now, 3); // 3 mois avant la fin

    const alertes = bureau.data.membres
      .filter((membre) => {
        return isBefore(membre.dateFinMandat, dateLimite) && isAfter(membre.dateFinMandat, now);
      })
      .map((membre) => ({
        id: membre.id,
        poste: membre.poste,
        adherent: `${membre.adherent.prenom} ${membre.adherent.nom}`,
        dateFinMandat: membre.dateFinMandat,
        joursRestants: Math.ceil(
          (membre.dateFinMandat.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        ),
      }));

    return {
      success: true,
      data: alertes,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des alertes:", error);
    return { success: false, error: "Erreur lors de la récupération des alertes" };
  }
}

/**
 * Récupère les statistiques du bureau
 */
export async function getBureauStats() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const bureau = await getBureauActuel();
    if (!bureau.success || !bureau.data?.membres) {
      return {
        success: true,
        data: {
          nombreMembres: 0,
          mandatsExpirant: 0,
          mandatsExpires: 0,
        },
      };
    }

    const now = new Date();
    const dateLimite = addMonths(now, 3);

    const mandatsExpirant = bureau.data.membres.filter(
      (m) => isBefore(m.dateFinMandat, dateLimite) && isAfter(m.dateFinMandat, now)
    ).length;

    const mandatsExpires = bureau.data.membres.filter((m) => isBefore(m.dateFinMandat, now)).length;

    return {
      success: true,
      data: {
        nombreMembres: bureau.data.membres.length,
        mandatsExpirant,
        mandatsExpires,
        dateElection: bureau.data.election?.dateCloture,
      },
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des statistiques:", error);
    return { success: false, error: "Erreur lors de la récupération des statistiques" };
  }
}

