// Server Actions pour la gestion des dépenses
"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { UserRole } from "@prisma/client";

// Schémas de validation
const CreateDepenseSchema = z.object({
  libelle: z.string().min(1, "Le libellé est requis"),
  montant: z.number().min(0, "Le montant doit être positif"),
  dateDepense: z.string().min(1, "La date est requise"),
  categorie: z.string().min(1, "La catégorie est requise"),
  description: z.string().optional(),
  justificatif: z.string().optional(), // URL du fichier uploadé
  statut: z.enum(["EnAttente", "Valide", "Rejete"]).default("EnAttente"),
});

const UpdateDepenseSchema = z.object({
  id: z.string().min(1, "ID requis"),
  libelle: z.string().optional(),
  montant: z.number().min(0).optional(),
  dateDepense: z.string().optional(),
  categorie: z.string().optional(),
  description: z.string().optional(),
  justificatif: z.string().optional(),
  statut: z.enum(["EnAttente", "Valide", "Rejete"]).optional(),
});

// Créer une nouvelle dépense
export async function createDepense(data: z.infer<typeof CreateDepenseSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const validatedData = CreateDepenseSchema.parse(data);

    const depense = await prisma.depense.create({
      data: {
        libelle: validatedData.libelle,
        montant: validatedData.montant,
        dateDepense: new Date(validatedData.dateDepense),
        categorie: validatedData.categorie,
        description: validatedData.description,
        justificatif: validatedData.justificatif,
        statut: validatedData.statut,
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

    // Convertir les Decimal en Number
    const depenseConverted = {
      ...depense,
      montant: Number(depense.montant)
    };

    return { success: true, data: depenseConverted };

  } catch (error) {
    console.error("Erreur lors de la création de la dépense:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

// Obtenir toutes les dépenses
export async function getAllDepenses() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const depenses = await prisma.depense.findMany({
      include: {
        CreatedBy: {
          select: {
            id: true,
            email: true,
          }
        }
      },
      orderBy: {
        dateDepense: 'desc'
      }
    });

    // Conversion des Decimal en nombres
    const depensesConverted = depenses.map((depense: any) => ({
      ...depense,
      montant: Number(depense.montant)
    }));

    return { success: true, data: depensesConverted };

  } catch (error) {
    console.error("Erreur lors de la récupération des dépenses:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

// Mettre à jour une dépense
export async function updateDepense(data: z.infer<typeof UpdateDepenseSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const validatedData = UpdateDepenseSchema.parse(data);

    const depense = await prisma.depense.update({
      where: { id: validatedData.id },
      data: {
        libelle: validatedData.libelle,
        montant: validatedData.montant,
        dateDepense: validatedData.dateDepense ? new Date(validatedData.dateDepense) : undefined,
        categorie: validatedData.categorie,
        description: validatedData.description,
        justificatif: validatedData.justificatif,
        statut: validatedData.statut,
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
    const depenseConverted = {
      ...depense,
      montant: Number(depense.montant)
    };

    return { success: true, data: depenseConverted };

  } catch (error) {
    console.error("Erreur lors de la mise à jour de la dépense:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

// Supprimer une dépense
export async function deleteDepense(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    await prisma.depense.delete({
      where: { id }
    });

    return { success: true, message: "Dépense supprimée avec succès" };

  } catch (error) {
    console.error("Erreur lors de la suppression de la dépense:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

// Obtenir les statistiques des dépenses
export async function getDepenseStats() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const currentMonth = new Date();
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    const [
      totalDepenses,
      depensesMois,
      depensesEnAttente,
      totalMontantMois,
      totalMontantGlobal
    ] = await Promise.all([
      prisma.depense.count(),
      prisma.depense.count({
        where: {
          dateDepense: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        }
      }),
      prisma.depense.count({
        where: {
          statut: "EnAttente"
        }
      }),
      prisma.depense.aggregate({
        where: {
          dateDepense: {
            gte: startOfMonth,
            lte: endOfMonth
          },
          statut: "Valide"
        },
        _sum: {
          montant: true
        }
      }),
      prisma.depense.aggregate({
        where: {
          statut: "Valide"
        },
        _sum: {
          montant: true
        }
      })
    ]);

    return {
      success: true,
      data: {
        totalDepenses,
        depensesMois,
        depensesEnAttente,
        totalMontantMois: Number(totalMontantMois._sum.montant || 0),
        totalMontantGlobal: Number(totalMontantGlobal._sum.montant || 0),
      }
    };

  } catch (error) {
    console.error("Erreur lors de la récupération des statistiques des dépenses:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

// Filtrer les dépenses
export async function filterDepenses(filters: {
  categorie?: string;
  statut?: string;
  dateDebut?: string;
  dateFin?: string;
  montantMin?: number;
  montantMax?: number;
  searchTerm?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const whereClause: any = {};

    if (filters.categorie) {
      whereClause.categorie = filters.categorie;
    }
    if (filters.statut) {
      whereClause.statut = filters.statut;
    }
    if (filters.dateDebut && filters.dateFin) {
      whereClause.dateDepense = {
        gte: new Date(filters.dateDebut),
        lte: new Date(filters.dateFin),
      };
    }
    if (filters.montantMin !== undefined) {
      whereClause.montant = { gte: filters.montantMin };
    }
    if (filters.montantMax !== undefined) {
      whereClause.montant = { ...whereClause.montant, lte: filters.montantMax };
    }
    if (filters.searchTerm) {
      whereClause.OR = [
        { libelle: { contains: filters.searchTerm, mode: 'insensitive' } },
        { categorie: { contains: filters.searchTerm, mode: 'insensitive' } },
        { description: { contains: filters.searchTerm, mode: 'insensitive' } },
      ];
    }

    const depenses = await prisma.depense.findMany({
      where: whereClause,
      include: {
        CreatedBy: {
          select: {
            id: true,
            email: true,
          }
        }
      },
      orderBy: {
        dateDepense: 'desc'
      }
    });

    // Conversion des Decimal en nombres
    const depensesConverted = depenses.map((depense: any) => ({
      ...depense,
      montant: Number(depense.montant)
    }));

    return { success: true, data: depensesConverted };

  } catch (error) {
    console.error("Erreur lors du filtrage des dépenses:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}
