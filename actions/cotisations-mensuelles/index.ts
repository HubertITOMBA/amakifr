// Server Actions pour la gestion des types de cotisation mensuelle
"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { calculerCotisationMensuelle } from "@/lib/utils/cotisations";
import { logCreation } from "@/lib/activity-logger";

// Schémas de validation
const CreateTypeCotisationSchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  description: z.string().optional(),
  montant: z.number().min(0, "Le montant doit être positif"),
  obligatoire: z.boolean().default(true),
  actif: z.boolean().default(true),
  ordre: z.number().int().min(0).default(0),
  aBeneficiaire: z.boolean().default(false), // Si ce type nécessite un adhérent bénéficiaire
});

const UpdateTypeCotisationSchema = z.object({
  id: z.string().min(1, "ID requis"),
  nom: z.string().min(1, "Le nom est requis").optional(),
  description: z.string().optional(),
  montant: z.number().min(0, "Le montant doit être positif").optional(),
  obligatoire: z.boolean().optional(),
  actif: z.boolean().optional(),
  ordre: z.number().int().min(0).optional(),
  aBeneficiaire: z.boolean().optional(), // Si ce type nécessite un adhérent bénéficiaire
});

const CreateCotisationMensuelleSchema = z.object({
  periode: z.string().min(1, "La période est requise"),
  annee: z.number().min(2020, "Année invalide"),
  mois: z.number().min(1).max(12, "Mois invalide"),
  typeCotisationIds: z.array(z.string()).min(1, "Au moins un type de cotisation requis"),
  adherentsIds: z.array(z.string()).optional(),
});

const UpdateCotisationMensuelleSchema = z.object({
  id: z.string().min(1, "ID requis"),
  montantAttendu: z.number().min(0, "Le montant doit être positif").optional(),
  dateEcheance: z.string().optional(),
  description: z.string().optional(),
  statut: z.enum(["EnAttente", "PartiellementPaye", "Paye", "EnRetard"]).optional(),
});

// Créer un nouveau type de cotisation mensuelle
export async function createTypeCotisationMensuelle(data: z.infer<typeof CreateTypeCotisationSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
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
        aBeneficiaire: validatedData.aBeneficiaire,
        createdBy: session.user.id,
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

    // Sérialisation complète pour éviter les erreurs de passage aux composants clients
    const typeCotisationConverted = {
      id: typeCotisation.id,
      nom: typeCotisation.nom,
      description: typeCotisation.description,
      montant: Number(typeCotisation.montant),
      obligatoire: typeCotisation.obligatoire,
      actif: typeCotisation.actif,
      ordre: typeCotisation.ordre,
      aBeneficiaire: typeCotisation.aBeneficiaire || false,
      createdBy: typeCotisation.createdBy,
      createdAt: typeCotisation.createdAt,
      updatedAt: typeCotisation.updatedAt,
      CreatedBy: typeCotisation.CreatedBy ? {
        id: typeCotisation.CreatedBy.id,
        email: typeCotisation.CreatedBy.email,
      } : null,
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
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
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

    // Conversion des Decimal en nombres (sérialisation complète pour éviter les erreurs de passage aux composants clients)
    const typesCotisationConverted = typesCotisation.map((type: any) => ({
      id: type.id,
      nom: type.nom,
      description: type.description,
      montant: Number(type.montant),
      obligatoire: type.obligatoire,
      actif: type.actif,
      ordre: type.ordre,
      aBeneficiaire: type.aBeneficiaire || false,
      createdBy: type.createdBy,
      createdAt: type.createdAt,
      updatedAt: type.updatedAt,
      CreatedBy: type.CreatedBy ? {
        id: type.CreatedBy.id,
        email: type.CreatedBy.email,
      } : null,
      _count: type._count ? {
        CotisationsMensuelles: type._count.CotisationsMensuelles,
      } : null,
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
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
      return { success: false, error: "Non autorisé" };
    }

    const validatedData = UpdateTypeCotisationSchema.parse(data);

    const updateData: any = {};
    if (validatedData.nom !== undefined) updateData.nom = validatedData.nom;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.montant !== undefined) updateData.montant = validatedData.montant;
    if (validatedData.obligatoire !== undefined) updateData.obligatoire = validatedData.obligatoire;
    if (validatedData.actif !== undefined) updateData.actif = validatedData.actif;
    if (validatedData.ordre !== undefined) updateData.ordre = validatedData.ordre;
    if (validatedData.aBeneficiaire !== undefined) updateData.aBeneficiaire = validatedData.aBeneficiaire;

    const typeCotisation = await prisma.typeCotisationMensuelle.update({
      where: { id: validatedData.id },
      data: updateData,
      include: {
        CreatedBy: {
          select: {
            id: true,
            email: true,
          }
        }
      }
    });

    // Sérialisation complète pour éviter les erreurs de passage aux composants clients
    const typeCotisationConverted = {
      id: typeCotisation.id,
      nom: typeCotisation.nom,
      description: typeCotisation.description,
      montant: Number(typeCotisation.montant),
      obligatoire: typeCotisation.obligatoire,
      actif: typeCotisation.actif,
      ordre: typeCotisation.ordre,
      aBeneficiaire: typeCotisation.aBeneficiaire || false,
      createdBy: typeCotisation.createdBy,
      createdAt: typeCotisation.createdAt,
      updatedAt: typeCotisation.updatedAt,
      CreatedBy: typeCotisation.CreatedBy ? {
        id: typeCotisation.CreatedBy.id,
        email: typeCotisation.CreatedBy.email,
      } : null,
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
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
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
// La cotisation du mois = Forfait mensuel (15€ ou montant variable) + Assistances du mois
export async function createCotisationsMensuelles(data: z.infer<typeof CreateCotisationMensuelleSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
      return { success: false, error: "Non autorisé" };
    }

    const validatedData = CreateCotisationMensuelleSchema.parse(data);
    const periode = `${validatedData.annee}-${validatedData.mois.toString().padStart(2, '0')}`;

    // Vérifier si des cotisations existent déjà pour cette période
    const existingCotisations = await prisma.cotisationMensuelle.findFirst({
      where: {
        periode,
      },
    });

    if (existingCotisations) {
      return { 
        success: false, 
        error: `Des cotisations existent déjà pour la période ${periode}. Une cotisation du mois ne peut être créée qu'une seule fois par mois.` 
      };
    }

    // Récupérer tous les adhérents actifs SAUF l'administrateur
    // L'administrateur ne cotise ni le frais d'adhésion, ni la cotisation forfaitaire, ni les assistances
    const adherents = await prisma.adherent.findMany({
      where: {
        User: {
          status: "Actif",
          role: { not: UserRole.ADMIN } // Exclure l'administrateur
        }
      },
      include: {
        User: true
      }
    });

    if (adherents.length === 0) {
      return { success: false, error: "Aucun adhérent actif trouvé (hors administrateur)" };
    }

    // Récupérer toutes les cotisations du mois pour cette période
    const cotisationsDuMois = await prisma.cotisationDuMois.findMany({
      where: {
        periode,
        statut: { not: "Annule" } // Exclure les cotisations annulées
      },
      include: {
        TypeCotisation: {
          select: {
            id: true,
            nom: true,
            montant: true,
            obligatoire: true,
          }
        },
        AdherentBeneficiaire: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
          }
        }
      },
      orderBy: [
        { TypeCotisation: { ordre: 'asc' } }
      ]
    });

    if (cotisationsDuMois.length === 0) {
      return { 
        success: false, 
        error: `Aucune cotisation du mois trouvée pour la période ${periode}. Veuillez d'abord créer les cotisations du mois.` 
      };
    }

    // Vérifier qu'il y a un forfait
    const cotisationForfait = cotisationsDuMois.find(cdm => 
      !cdm.TypeCotisation?.aBeneficiaire
    );

    if (!cotisationForfait) {
      return { 
        success: false, 
        error: `Cotisation forfaitaire mensuelle non trouvée pour la période ${periode}. Veuillez créer une cotisation du mois de type "Forfait Mensuel".` 
      };
    }

    const cotisationsCreated = [] as any[];
    const bulkData = [] as any[];

    // Pour chaque adhérent, calculer et créer une cotisation mensuelle
    for (const adherent of adherents) {
      // Utiliser la fonction utilitaire pour calculer le montant et générer la description
      const result = calculerCotisationMensuelle(
        adherent.id,
        periode,
        cotisationsDuMois.map(cdm => ({
          id: cdm.id,
          periode: cdm.periode,
          montantBase: Number(cdm.montantBase),
          adherentBeneficiaireId: cdm.adherentBeneficiaireId,
          TypeCotisation: {
            id: cdm.TypeCotisation.id,
            nom: cdm.TypeCotisation.nom || "Assistance",
            aBeneficiaire: cdm.TypeCotisation.aBeneficiaire || false,
          },
          AdherentBeneficiaire: cdm.AdherentBeneficiaire || null,
        }))
      );

      // Créer une seule cotisation mensuelle par adhérent
      bulkData.push({
        periode,
        annee: validatedData.annee,
        mois: validatedData.mois,
        typeCotisationId: cotisationForfait.TypeCotisation?.id || cotisationForfait.typeCotisationId, // Utiliser le type Forfait
        adherentId: adherent.id,
        montantAttendu: result.montantTotal,
        montantPaye: 0,
        montantRestant: result.montantTotal,
        dateEcheance: cotisationForfait.dateEcheance,
        statut: "EnAttente",
        description: result.description,
        cotisationDuMoisId: cotisationForfait.id, // Lier à la cotisation du mois
        createdBy: session.user.id,
      });
    }

    // Insérer en lot en ignorant les doublons (index unique composite)
    const createManyResult = await prisma.cotisationMensuelle.createMany({
      data: bulkData,
      skipDuplicates: true,
    });

    const createdCount = createManyResult.count;

    // Appliquer automatiquement les avoirs disponibles sur les nouvelles cotisations
    const { appliquerAvoirs } = await import("@/actions/paiements/index");
    const Decimal = (await import("@prisma/client/runtime/library")).Decimal;
    let avoirsAppliques = 0;

    // Récupérer les cotisations créées pour appliquer les avoirs
    const cotisationsCreees = await prisma.cotisationMensuelle.findMany({
      where: {
        periode,
        typeCotisationId: cotisationForfait.TypeCotisation?.id || cotisationForfait.typeCotisationId,
      },
    });

    for (const cotisation of cotisationsCreees) {
      // Appliquer les avoirs disponibles
      const montantApresAvoirs = await appliquerAvoirs(
        cotisation.adherentId,
        new Decimal(cotisation.montantRestant),
        'cotisationMensuelle',
        cotisation.id
      );

      if (montantApresAvoirs.lt(cotisation.montantRestant)) {
        // Des avoirs ont été appliqués
        const montantAvoirsAppliques = new Decimal(cotisation.montantRestant).minus(montantApresAvoirs);
        const nouveauMontantPaye = new Decimal(cotisation.montantPaye).plus(montantAvoirsAppliques);
        const nouveauStatut = montantApresAvoirs.lte(0) ? "Paye" : nouveauMontantPaye.gt(0) ? "PartiellementPaye" : "EnAttente";

        // Utiliser Decimal.max() (méthode statique) ou Math.max() avec conversion
        const montantRestantFinal = montantApresAvoirs.gte(0) ? montantApresAvoirs : new Decimal(0);

        await prisma.cotisationMensuelle.update({
          where: { id: cotisation.id },
          data: {
            montantPaye: nouveauMontantPaye,
            montantRestant: montantRestantFinal,
            statut: nouveauStatut,
          },
        });

        avoirsAppliques++;
      }
    }

    let message = `${createdCount} cotisation(s) mensuelle(s) créées pour ${adherents.length} adhérent(s). Chaque cotisation inclut le forfait mensuel + les assistances du mois.`;
    if (avoirsAppliques > 0) {
      message += ` ${avoirsAppliques} cotisation(s) ont été partiellement ou totalement payées avec des avoirs disponibles.`;
    }

    // Logger l'activité
    try {
      await logCreation(
        `Création de ${createdCount} cotisation(s) mensuelle(s) pour la période ${periode}`,
        "CotisationMensuelle",
        periode,
        {
          periode,
          annee: validatedData.annee,
          mois: validatedData.mois,
          count: createdCount,
          totalAdherents: adherents.length,
          avoirsAppliques,
        }
      );
    } catch (logError) {
      console.error("Erreur lors du logging de l'activité:", logError);
      // Ne pas bloquer la création si le logging échoue
    }

    // Revalider les pages des adhérents et de gestion
    // Note: L'administrateur n'a pas de cotisations, donc son profil ne sera pas mis à jour
    revalidatePath("/user/profile");
    revalidatePath("/admin/cotisations");
    revalidatePath("/admin/cotisations/gestion");

    return { 
      success: true, 
      message,
      data: {
        cotisationsCreated: createdCount,
        adherentsCount: adherents.length,
        montantForfait: Number(cotisationForfait.montantBase),
        avoirsAppliques
      }
    };

  } catch (error) {
    console.error("Erreur lors de la création des cotisations mensuelles:", error);
    return { success: false, error: "Erreur interne du serveur" };
  } finally {
    // Revalider même en cas d'erreur partielle
    revalidatePath("/user/profile");
    revalidatePath("/admin/cotisations");
    revalidatePath("/admin/cotisations/gestion");
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

    if (session.user.role !== UserRole.ADMIN && adherent.userId !== session.user.id) {
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
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
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

/**
 * Met à jour une cotisation mensuelle (uniquement pour le mois en cours ou mois en cours + 1)
 * 
 * @param data - Les données de mise à jour contenant l'ID et les champs à modifier
 * @returns Un objet avec success (boolean), data (cotisation mise à jour) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function updateCotisationMensuelle(data: z.infer<typeof UpdateCotisationMensuelleSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
      return { success: false, error: "Non autorisé" };
    }

    const validatedData = UpdateCotisationMensuelleSchema.parse(data);

    // Récupérer la cotisation existante
    const cotisation = await prisma.cotisationMensuelle.findUnique({
      where: { id: validatedData.id },
      include: {
        TypeCotisation: true
      }
    });

    if (!cotisation) {
      return { success: false, error: "Cotisation non trouvée" };
    }

    // Vérifier que la cotisation est du mois en cours ou mois en cours + 1
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;

    const isCurrentMonth = cotisation.annee === currentYear && cotisation.mois === currentMonth;
    const isNextMonth = cotisation.annee === nextYear && cotisation.mois === nextMonth;

    if (!isCurrentMonth && !isNextMonth) {
      return { 
        success: false, 
        error: "Seules les cotisations du mois en cours ou du mois suivant peuvent être modifiées" 
      };
    }

    // Préparer les données de mise à jour
    const updateData: any = {};
    
    if (validatedData.montantAttendu !== undefined) {
      updateData.montantAttendu = validatedData.montantAttendu;
      // Recalculer le montant restant si le montant attendu change
      const montantPaye = Number(cotisation.montantPaye);
      const nouveauMontantRestant = validatedData.montantAttendu - montantPaye;
      updateData.montantRestant = nouveauMontantRestant >= 0 ? nouveauMontantRestant : 0;
      
      // Mettre à jour le statut en fonction du montant restant
      if (nouveauMontantRestant <= 0) {
        updateData.statut = "Paye";
      } else if (montantPaye > 0) {
        updateData.statut = "PartiellementPaye";
      } else {
        updateData.statut = cotisation.statut === "EnRetard" ? "EnRetard" : "EnAttente";
      }
    }

    if (validatedData.dateEcheance) {
      updateData.dateEcheance = new Date(validatedData.dateEcheance);
    }

    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description;
    }

    if (validatedData.statut !== undefined) {
      updateData.statut = validatedData.statut;
    }

    // Mettre à jour la cotisation
    const cotisationUpdated = await prisma.cotisationMensuelle.update({
      where: { id: validatedData.id },
      data: updateData,
      include: {
        TypeCotisation: {
          select: {
            id: true,
            nom: true,
            description: true,
            montant: true,
            obligatoire: true,
          }
        },
        Adherent: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
            User: {
              select: {
                email: true
              }
            }
          }
        }
      }
    });

    // Convertir les Decimal en nombres
    const cotisationConverted = {
      ...cotisationUpdated,
      montantAttendu: Number(cotisationUpdated.montantAttendu),
      montantPaye: Number(cotisationUpdated.montantPaye),
      montantRestant: Number(cotisationUpdated.montantRestant),
      TypeCotisation: {
        ...cotisationUpdated.TypeCotisation,
        montant: Number(cotisationUpdated.TypeCotisation.montant)
      }
    };

    revalidatePath("/admin/cotisations");
    revalidatePath("/admin/cotisations/gestion");
    revalidatePath("/user/profile");

    return { success: true, data: cotisationConverted, message: "Cotisation mise à jour avec succès" };

  } catch (error) {
    console.error("Erreur lors de la mise à jour de la cotisation mensuelle:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: "Erreur interne du serveur" };
  }
}

/**
 * Récupère les cotisations mensuelles créées pour une période donnée
 * 
 * @param periode - La période au format "YYYY-MM" (ex: "2024-01")
 * @returns Un objet avec success (boolean), data (array de cotisations) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function getCotisationsMensuellesByPeriode(periode: string) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
      return { success: false, error: "Non autorisé" };
    }

    const cotisationsMensuelles = await prisma.cotisationMensuelle.findMany({
      where: {
        periode: periode
      },
      include: {
        TypeCotisation: {
          select: {
            id: true,
            nom: true,
            description: true,
            montant: true,
            obligatoire: true,
          }
        },
        Adherent: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
            User: {
              select: {
                email: true
              }
            }
          }
        },
        CreatedBy: {
          select: {
            name: true,
            email: true
          }
        },
        _count: {
          select: {
            Paiements: true
          }
        }
      },
      orderBy: [
        { TypeCotisation: { ordre: 'asc' } },
        { Adherent: { User: { email: 'asc' } } }
      ]
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

/**
 * Récupère toutes les cotisations mensuelles pour l'admin
 * 
 * @returns Un objet avec success (boolean), data (array de cotisations) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function getAllCotisationsMensuelles() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
      return { success: false, error: "Non autorisé" };
    }

    const cotisationsMensuelles = await prisma.cotisationMensuelle.findMany({
      include: {
        TypeCotisation: {
          select: {
            id: true,
            nom: true,
            description: true,
            montant: true,
            obligatoire: true,
          }
        },
        Adherent: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
            User: {
              select: {
                email: true
              }
            }
          }
        },
        CreatedBy: {
          select: {
            name: true,
            email: true
          }
        },
        _count: {
          select: {
            Paiements: true
          }
        }
      },
      orderBy: [
        { periode: 'desc' },
        { TypeCotisation: { ordre: 'asc' } },
        { Adherent: { User: { email: 'asc' } } }
      ]
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
    console.error("Erreur lors de la récupération de toutes les cotisations mensuelles:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}
