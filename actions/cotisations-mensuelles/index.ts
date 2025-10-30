// Server Actions pour la gestion des types de cotisation mensuelle
"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { UserRole } from "@prisma/client";

// Schémas de validation
const CreateTypeCotisationSchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  description: z.string().optional(),
  montant: z.number().min(0, "Le montant doit être positif"),
  obligatoire: z.boolean().default(true),
  actif: z.boolean().default(true),
  ordre: z.number().int().min(0).default(0),
});

const UpdateTypeCotisationSchema = z.object({
  id: z.string().min(1, "ID requis"),
  nom: z.string().min(1, "Le nom est requis").optional(),
  description: z.string().optional(),
  montant: z.number().min(0, "Le montant doit être positif").optional(),
  obligatoire: z.boolean().optional(),
  actif: z.boolean().optional(),
  ordre: z.number().int().min(0).optional(),
});

const CreateCotisationMensuelleSchema = z.object({
  periode: z.string().min(1, "La période est requise"),
  annee: z.number().min(2020, "Année invalide"),
  mois: z.number().min(1).max(12, "Mois invalide"),
  typeCotisationIds: z.array(z.string()).min(1, "Au moins un type de cotisation requis"),
  adherentsIds: z.array(z.string()).optional(),
});

// Créer un nouveau type de cotisation mensuelle
export async function createTypeCotisationMensuelle(data: z.infer<typeof CreateTypeCotisationSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const validatedData = CreateTypeCotisationSchema.parse(data);

    const typeCotisation = await prisma.typeCotisationMensuelle.create({
      data: {
        nom: validatedData.nom,
        description: validatedData.description,
        montant: validatedData.montant,
        obligatoire: validatedData.obligatoire,
        actif: validatedData.actif,
        ordre: validatedData.ordre,
        createdBy: session.user.id,
      },
    });

    // Convertir les Decimal en Number
    const typeCotisationConverted = {
      ...typeCotisation,
      montant: Number(typeCotisation.montant)
    };

    return { success: true, data: typeCotisationConverted };

  } catch (error) {
    console.error("Erreur lors de la création du type de cotisation:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

// Obtenir tous les types de cotisation mensuelle
export async function getAllTypesCotisationMensuelle() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const typesCotisation = await prisma.typeCotisationMensuelle.findMany({
      include: {
        CreatedBy: {
          select: {
            id: true,
            email: true,
          }
        },
        _count: {
          select: {
            CotisationsMensuelles: true
          }
        }
      },
      orderBy: [
        { ordre: 'asc' },
        { nom: 'asc' }
      ]
    });

    // Conversion des Decimal en nombres
    const typesCotisationConverted = typesCotisation.map((type: any) => ({
      ...type,
      montant: Number(type.montant)
    }));

    return { success: true, data: typesCotisationConverted };

  } catch (error) {
    console.error("Erreur lors de la récupération des types de cotisation:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

// Mettre à jour un type de cotisation mensuelle
export async function updateTypeCotisationMensuelle(data: z.infer<typeof UpdateTypeCotisationSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const validatedData = UpdateTypeCotisationSchema.parse(data);

    const typeCotisation = await prisma.typeCotisationMensuelle.update({
      where: { id: validatedData.id },
      data: {
        nom: validatedData.nom,
        description: validatedData.description,
        montant: validatedData.montant,
        obligatoire: validatedData.obligatoire,
        actif: validatedData.actif,
        ordre: validatedData.ordre,
      },
      include: {
        CreatedBy: {
          select: {
            id: true,
            email: true,
          }
        }
      }
    });

    // Convertir les Decimal en Number
    const typeCotisationConverted = {
      ...typeCotisation,
      montant: Number(typeCotisation.montant)
    };

    return { success: true, data: typeCotisationConverted };

  } catch (error) {
    console.error("Erreur lors de la mise à jour du type de cotisation:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

// Supprimer un type de cotisation mensuelle
export async function deleteTypeCotisationMensuelle(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier s'il y a des cotisations mensuelles liées
    const cotisationsCount = await prisma.cotisationMensuelle.count({
      where: { typeCotisationId: id }
    });

    if (cotisationsCount > 0) {
      return { 
        success: false, 
        error: `Impossible de supprimer ce type de cotisation car ${cotisationsCount} cotisation(s) mensuelle(s) y sont liées` 
      };
    }

    await prisma.typeCotisationMensuelle.delete({
      where: { id }
    });

    return { success: true, message: "Type de cotisation supprimé avec succès" };

  } catch (error) {
    console.error("Erreur lors de la suppression du type de cotisation:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

// Créer les cotisations mensuelles pour tous les adhérents
export async function createCotisationsMensuelles(data: z.infer<typeof CreateCotisationMensuelleSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const validatedData = CreateCotisationMensuelleSchema.parse(data);
    const periode = `${validatedData.annee}-${validatedData.mois.toString().padStart(2, '0')}`;

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

    // Récupérer les types de cotisation
    const typesCotisation = await prisma.typeCotisationMensuelle.findMany({
      where: {
        id: { in: validatedData.typeCotisationIds },
        actif: true
      }
    });

    if (typesCotisation.length === 0) {
      return { success: false, error: "Aucun type de cotisation actif trouvé" };
    }

    const cotisationsCreated = [];

    // Créer les cotisations mensuelles pour chaque adhérent et chaque type
    for (const adherent of adherents) {
      for (const typeCotisation of typesCotisation) {
        const cotisationMensuelle = await prisma.cotisationMensuelle.create({
          data: {
            periode,
            annee: validatedData.annee,
            mois: validatedData.mois,
            typeCotisationId: typeCotisation.id,
            adherentId: adherent.id,
            montantAttendu: typeCotisation.montant,
            montantPaye: 0,
            montantRestant: typeCotisation.montant,
            dateEcheance: new Date(validatedData.annee, validatedData.mois - 1, 15), // 15 du mois
            statut: "EnAttente",
            description: `Cotisation ${typeCotisation.nom} - ${periode}`,
            createdBy: session.user.id,
          }
        });

        // Convertir les Decimal en Number
        cotisationsCreated.push({
          ...cotisationMensuelle,
          montantAttendu: Number(cotisationMensuelle.montantAttendu),
          montantPaye: Number(cotisationMensuelle.montantPaye),
          montantRestant: Number(cotisationMensuelle.montantRestant)
        });
      }
    }

    return { 
      success: true, 
      message: `${cotisationsCreated.length} cotisations mensuelles créées pour ${adherents.length} adhérents`,
      data: {
        cotisationsCreated: cotisationsCreated.length,
        adherentsCount: adherents.length,
        typesCount: typesCotisation.length
      }
    };

  } catch (error) {
    console.error("Erreur lors de la création des cotisations mensuelles:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

// Obtenir les cotisations mensuelles d'un adhérent
export async function getCotisationsMensuellesAdherent(adherentId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que l'utilisateur est admin ou que c'est son propre profil
    const adherent = await prisma.adherent.findUnique({
      where: { id: adherentId },
      select: { userId: true }
    });

    if (!adherent) {
      return { success: false, error: "Adhérent non trouvé" };
    }

    if (session.user.role !== UserRole.Admin && adherent.userId !== session.user.id) {
      return { success: false, error: "Non autorisé" };
    }

    const cotisationsMensuelles = await prisma.cotisationMensuelle.findMany({
      where: { adherentId },
      include: {
        TypeCotisation: true,
        Adherent: {
          include: {
            User: true
          }
        }
      },
      orderBy: {
        periode: 'desc'
      }
    });

    // Conversion des Decimal en nombres
    const cotisationsConverted = cotisationsMensuelles.map((cotisation: any) => ({
      ...cotisation,
      montantAttendu: Number(cotisation.montantAttendu),
      montantPaye: Number(cotisation.montantPaye),
      montantRestant: Number(cotisation.montantRestant),
      TypeCotisation: {
        ...cotisation.TypeCotisation,
        montant: Number(cotisation.TypeCotisation.montant)
      }
    }));

    return { success: true, data: cotisationsConverted };

  } catch (error) {
    console.error("Erreur lors de la récupération des cotisations mensuelles:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

// Obtenir les statistiques des cotisations mensuelles
export async function getCotisationsMensuellesStats() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const currentMonth = new Date();
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    const [
      totalTypesCotisation,
      typesActifs,
      totalCotisationsMois,
      totalDettes,
      adherentsEnRetard
    ] = await Promise.all([
      prisma.typeCotisationMensuelle.count(),
      prisma.typeCotisationMensuelle.count({
        where: { actif: true }
      }),
      prisma.cotisationMensuelle.count({
        where: {
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        }
      }),
      prisma.cotisationMensuelle.aggregate({
        where: {
          statut: { in: ["EnAttente", "PartiellementPaye", "EnRetard"] }
        },
        _sum: {
          montantRestant: true
        }
      }),
      prisma.adherent.count({
        where: {
          CotisationsMensuelles: {
            some: {
              statut: "EnRetard"
            }
          }
        }
      })
    ]);

    return {
      success: true,
      data: {
        totalTypesCotisation,
        typesActifs,
        totalCotisationsMois,
        totalDettes: Number(totalDettes._sum.montantRestant || 0),
        adherentsEnRetard,
      }
    };

  } catch (error) {
    console.error("Erreur lors de la récupération des statistiques:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}
