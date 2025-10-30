// Server Actions pour la gestion des cotisations mensuelles
"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { UserRole, TypeCotisation, MoyenPaiement } from "@prisma/client";

// Schémas de validation
const CreateMonthlyCotisationSchema = z.object({
  mois: z.string().min(1, "Le mois est requis"),
  annee: z.number().min(2020, "Année invalide"),
  montantForfait: z.number().min(0, "Montant forfait invalide"),
  montantOccasionnel: z.number().min(0, "Montant occasionnel invalide"),
  adherentsIds: z.array(z.string()).optional(),
});

const CreateCotisationSchema = z.object({
  adherentId: z.string().min(1, "Adhérent requis"),
  type: z.enum(["Forfait", "Assistance", "Anniversaire", "Adhesion"]),
  montant: z.number().min(0, "Montant invalide"),
  moyenPaiement: z.enum(["Especes", "Cheque", "Virement", "CarteBancaire"]),
  description: z.string().optional(),
  reference: z.string().optional(),
});

const UpdateCotisationSchema = z.object({
  id: z.string().min(1, "ID requis"),
  montant: z.number().min(0, "Montant invalide").optional(),
  statut: z.enum(["Valide", "Annule", "EnAttente"]).optional(),
  description: z.string().optional(),
});

// Créer les cotisations mensuelles pour tous les adhérents
export async function createMonthlyCotisations(data: z.infer<typeof CreateMonthlyCotisationSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const validatedData = CreateMonthlyCotisationSchema.parse(data);
    const periode = `${validatedData.annee}-${validatedData.mois.padStart(2, '0')}`;

    // Récupérer tous les adhérents actifs
    const adherents = await prisma.adherent.findMany({
      where: {
        User: {
          status: "Actif"
        }
      },
      include: {
        User: true
      }
    });

    if (adherents.length === 0) {
      return { success: false, error: "Aucun adhérent actif trouvé" };
    }

    const cotisationsCreated = [];

    // Créer les obligations de cotisation pour chaque adhérent
    for (const adherent of adherents) {
      // Cotisation forfait mensuelle
      const obligationForfait = await prisma.obligationCotisation.create({
        data: {
          adherentId: adherent.id,
          type: TypeCotisation.Forfait,
          montantAttendu: validatedData.montantForfait,
          montantPaye: 0,
          montantRestant: validatedData.montantForfait,
          dateEcheance: new Date(validatedData.annee, parseInt(validatedData.mois) - 1, 15), // 15 du mois
          periode: `${periode}-Forfait`,
          statut: "EnAttente",
          description: `Cotisation forfait mensuelle ${periode}`,
        }
      });

      // Cotisation occasionnelle mensuelle
      const obligationOccasionnel = await prisma.obligationCotisation.create({
        data: {
          adherentId: adherent.id,
          type: TypeCotisation.Assistance,
          montantAttendu: validatedData.montantOccasionnel,
          montantPaye: 0,
          montantRestant: validatedData.montantOccasionnel,
          dateEcheance: new Date(validatedData.annee, parseInt(validatedData.mois) - 1, 15),
          periode: `${periode}-Occasionnel`,
          statut: "EnAttente",
          description: `Cotisation occasionnelle mensuelle ${periode}`,
        }
      });

      // Convertir les Decimal en Number pour le retour
      cotisationsCreated.push(
        {
          ...obligationForfait,
          montantAttendu: Number(obligationForfait.montantAttendu),
          montantPaye: Number(obligationForfait.montantPaye),
          montantRestant: Number(obligationForfait.montantRestant)
        },
        {
          ...obligationOccasionnel,
          montantAttendu: Number(obligationOccasionnel.montantAttendu),
          montantPaye: Number(obligationOccasionnel.montantPaye),
          montantRestant: Number(obligationOccasionnel.montantRestant)
        }
      );
    }

    return { 
      success: true, 
      message: `${cotisationsCreated.length} obligations de cotisation créées pour ${adherents.length} adhérents`,
      data: cotisationsCreated.length
    };

  } catch (error) {
    console.error("Erreur lors de la création des cotisations mensuelles:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

// Créer une cotisation manuelle (pour paiement en espèces)
export async function createManualCotisation(data: z.infer<typeof CreateCotisationSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const validatedData = CreateCotisationSchema.parse(data);

    const cotisation = await prisma.cotisation.create({
      data: {
        adherentId: validatedData.adherentId,
        type: validatedData.type as TypeCotisation,
        montant: validatedData.montant,
        moyenPaiement: validatedData.moyenPaiement as MoyenPaiement,
        description: validatedData.description || `Cotisation ${validatedData.type}`,
        reference: validatedData.reference || `MAN-${Date.now()}`,
        statut: "Valide",
      },
      include: {
        Adherent: {
          include: {
            User: true
          }
        }
      }
    });

    // Convertir les Decimal en Number
    const cotisationConverted = {
      ...cotisation,
      montant: Number(cotisation.montant)
    };

    // Mettre à jour l'obligation correspondante si elle existe
    const obligation = await prisma.obligationCotisation.findFirst({
      where: {
        adherentId: validatedData.adherentId,
        type: validatedData.type as TypeCotisation,
        statut: { in: ["EnAttente", "PartiellementPaye"] }
      }
    });

    if (obligation) {
      const nouveauMontantPaye = Number(obligation.montantPaye) + validatedData.montant;
      const nouveauMontantRestant = Number(obligation.montantAttendu) - nouveauMontantPaye;
      
      let nouveauStatut = "PartiellementPaye";
      if (nouveauMontantRestant <= 0) {
        nouveauStatut = "Paye";
      }

      await prisma.obligationCotisation.update({
        where: { id: obligation.id },
        data: {
          montantPaye: nouveauMontantPaye,
          montantRestant: Math.max(0, nouveauMontantRestant),
          statut: nouveauStatut,
        }
      });
    }

    return { success: true, data: cotisationConverted };

  } catch (error) {
    console.error("Erreur lors de la création de la cotisation manuelle:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

// Obtenir la liste des adhérents avec leurs cotisations
export async function getAdherentsWithCotisations() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const adherents = await prisma.adherent.findMany({
      include: {
        User: {
          select: {
            id: true,
            email: true,
            status: true,
            lastLogin: true,
          }
        },
        ObligationsCotisation: {
          where: {
            statut: { in: ["EnAttente", "PartiellementPaye", "EnRetard"] }
          },
          orderBy: {
            dateEcheance: 'desc'
          }
        },
        Cotisations: {
          orderBy: {
            dateCotisation: 'desc'
          },
          take: 5 // Dernières 5 cotisations
        },
        _count: {
          select: {
            ObligationsCotisation: {
              where: {
                statut: { in: ["EnAttente", "PartiellementPaye", "EnRetard"] }
              }
            },
            Cotisations: true
          }
        }
      },
      orderBy: {
        User: {
          email: 'asc'
        }
      }
    });

    // Calculer les dettes pour chaque adhérent
    const adherentsWithDebt = adherents.map(adherent => {
      const totalDette = adherent.ObligationsCotisation.reduce((sum, obligation) => {
        return sum + Number(obligation.montantRestant);
      }, 0);

      const cotisationMensuelle = 15 + 50; // Forfait + Occasionnel
      const moisDeRetard = Math.floor(totalDette / cotisationMensuelle);

      return {
        ...adherent,
        ObligationsCotisation: adherent.ObligationsCotisation.map((obligation: any) => ({
          ...obligation,
          montantAttendu: Number(obligation.montantAttendu),
          montantPaye: Number(obligation.montantPaye),
          montantRestant: Number(obligation.montantRestant)
        })),
        Cotisations: adherent.Cotisations.map((cotisation: any) => ({
          ...cotisation,
          montant: Number(cotisation.montant)
        })),
        totalDette: Number(totalDette.toFixed(2)),
        moisDeRetard,
        enRetard: moisDeRetard >= 3,
        montantForfait: Number(adherent.ObligationsCotisation.find(o => o.type === "Forfait")?.montantRestant || 0),
        montantOccasionnel: Number(adherent.ObligationsCotisation.find(o => o.type === "Assistance")?.montantRestant || 0),
      };
    });

    return { success: true, data: adherentsWithDebt };

  } catch (error) {
    console.error("Erreur lors de la récupération des adhérents:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

// Mettre à jour une cotisation
export async function updateCotisation(data: z.infer<typeof UpdateCotisationSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const validatedData = UpdateCotisationSchema.parse(data);

    const cotisation = await prisma.cotisation.update({
      where: { id: validatedData.id },
      data: {
        montant: validatedData.montant,
        statut: validatedData.statut,
        description: validatedData.description,
      },
      include: {
        Adherent: {
          include: {
            User: true
          }
        }
      }
    });

    // Convertir les Decimal en Number
    const cotisationConverted = {
      ...cotisation,
      montant: Number(cotisation.montant)
    };

    return { success: true, data: cotisationConverted };

  } catch (error) {
    console.error("Erreur lors de la mise à jour de la cotisation:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

// Obtenir les statistiques des cotisations
export async function getCotisationStats() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const [
      totalAdherents,
      adherentsEnRetard,
      totalCotisationsMois,
      totalDettes,
      cotisationsValidees
    ] = await Promise.all([
      prisma.adherent.count({
        where: {
          User: { status: "Actif" }
        }
      }),
      prisma.adherent.count({
        where: {
          ObligationsCotisation: {
            some: {
              statut: "EnRetard"
            }
          }
        }
      }),
      prisma.cotisation.count({
        where: {
          dateCotisation: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),
      prisma.obligationCotisation.aggregate({
        where: {
          statut: { in: ["EnAttente", "PartiellementPaye", "EnRetard"] }
        },
        _sum: {
          montantRestant: true
        }
      }),
      prisma.cotisation.count({
        where: {
          statut: "Valide",
          dateCotisation: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      })
    ]);

    return {
      success: true,
      data: {
        totalAdherents,
        adherentsEnRetard,
        totalCotisationsMois,
        totalDettes: Number(totalDettes._sum.montantRestant || 0),
        cotisationsValidees,
        tauxRecouvrement: totalCotisationsMois > 0 ? (cotisationsValidees / totalCotisationsMois * 100).toFixed(1) : 0
      }
    };

  } catch (error) {
    console.error("Erreur lors de la récupération des statistiques:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

// Envoyer des relances automatiques
export async function sendAutomaticReminders() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    // Trouver les adhérents avec une dette >= 3 mois
    const adherentsEnRetard = await prisma.adherent.findMany({
      where: {
        ObligationsCotisation: {
          some: {
            statut: "EnRetard"
          }
        }
      },
      include: {
        User: true,
        ObligationsCotisation: {
          where: {
            statut: "EnRetard"
          }
        }
      }
    });

    const relancesEnvoyees = [];

    for (const adherent of adherentsEnRetard) {
      const totalDette = adherent.ObligationsCotisation.reduce((sum, obligation) => {
        return sum + Number(obligation.montantRestant);
      }, 0);

      const cotisationMensuelle = 15 + 50;
      const moisDeRetard = Math.floor(totalDette / cotisationMensuelle);

      if (moisDeRetard >= 3) {
        // Créer une relance
        for (const obligation of adherent.ObligationsCotisation) {
          const relance = await prisma.relance.create({
            data: {
              adherentId: adherent.id,
              obligationCotisationId: obligation.id,
              type: "Email",
              statut: "EnAttente",
              contenu: `Bonjour ${adherent.firstname},\n\nVotre cotisation de ${Number(obligation.montantRestant).toFixed(2).replace('.', ',')} € est en retard de ${moisDeRetard} mois.\n\nVeuillez régulariser votre situation.\n\nCordialement,\nL'équipe AMAKI`,
              montantRappele: obligation.montantRestant,
            }
          });
          relancesEnvoyees.push(relance);
        }
      }
    }

    return { 
      success: true, 
      message: `${relancesEnvoyees.length} relances créées`,
      data: relancesEnvoyees.length
    };

  } catch (error) {
    console.error("Erreur lors de l'envoi des relances:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}
