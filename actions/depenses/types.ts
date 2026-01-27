// Server Actions pour la gestion des types de dépenses
"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { logCreation, logModification } from "@/lib/activity-logger";

// Schémas de validation
const CreateTypeDepenseSchema = z.object({
  titre: z.string().min(1, "Le titre est requis").max(200, "Le titre ne peut pas dépasser 200 caractères"),
  description: z.string().optional(),
  actif: z.boolean().default(true),
});

const UpdateTypeDepenseSchema = z.object({
  id: z.string().min(1, "ID requis"),
  titre: z.string().min(1, "Le titre est requis").max(200, "Le titre ne peut pas dépasser 200 caractères").optional(),
  description: z.string().optional(),
  actif: z.boolean().optional(),
});

/**
 * Crée un nouveau type de dépense
 * 
 * @param data - Les données du type de dépense (titre, description, actif)
 * @returns Un objet avec success (boolean), data (TypeDepense) en cas de succès, ou error (string) en cas d'échec
 */
export async function createTypeDepense(data: z.infer<typeof CreateTypeDepenseSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
      return { success: false, error: "Non autorisé" };
    }

    const validatedData = CreateTypeDepenseSchema.parse(data);

    const typeDepense = await prisma.typeDepense.create({
      data: {
        titre: validatedData.titre,
        description: validatedData.description,
        actif: validatedData.actif,
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

    revalidatePath("/admin/depenses");
    revalidatePath("/admin/depenses/types");

    return { success: true, data: typeDepense };

  } catch (error) {
    console.error("Erreur lors de la création du type de dépense:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: "Erreur interne du serveur" };
  }
}

/**
 * Récupère tous les types de dépenses
 * 
 * @returns Un objet avec success (boolean), data (TypeDepense[]) en cas de succès, ou error (string) en cas d'échec
 */
export async function getAllTypesDepense() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
      return { success: false, error: "Non autorisé" };
    }

    const typesDepense = await prisma.typeDepense.findMany({
      include: {
        CreatedBy: {
          select: {
            id: true,
            email: true,
          }
        },
        _count: {
          select: {
            Depenses: true,
          }
        }
      },
      orderBy: {
        titre: 'asc'
      }
    });

    return { success: true, data: typesDepense };

  } catch (error) {
    console.error("Erreur lors de la récupération des types de dépense:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

/**
 * Met à jour un type de dépense
 * 
 * @param data - Les données à mettre à jour (id requis, autres champs optionnels)
 * @returns Un objet avec success (boolean), data (TypeDepense) en cas de succès, ou error (string) en cas d'échec
 */
export async function updateTypeDepense(data: z.infer<typeof UpdateTypeDepenseSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
      return { success: false, error: "Non autorisé" };
    }

    const validatedData = UpdateTypeDepenseSchema.parse(data);

    const typeDepense = await prisma.typeDepense.update({
      where: { id: validatedData.id },
      data: {
        titre: validatedData.titre,
        description: validatedData.description,
        actif: validatedData.actif,
      },
      include: {
        CreatedBy: {
          select: {
            id: true,
            email: true,
          }
        },
        _count: {
          select: {
            Depenses: true,
          }
        }
      }
    });

    // Logger l'activité
    try {
      await logModification(
        `Modification du type de dépense: ${validatedData.titre || validatedData.id}`,
        "TypeDepense",
        validatedData.id,
        {
          fieldsUpdated: Object.keys(validatedData).filter(key => key !== 'id'),
          actif: validatedData.actif,
        }
      );
    } catch (logError) {
      console.error("Erreur lors du logging de l'activité:", logError);
      // Ne pas bloquer la mise à jour si le logging échoue
    }

    revalidatePath("/admin/depenses");
    revalidatePath("/admin/depenses/types");

    return { success: true, data: typeDepense };

  } catch (error) {
    console.error("Erreur lors de la mise à jour du type de dépense:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: "Erreur interne du serveur" };
  }
}

/**
 * Supprime un type de dépense
 * 
 * @param id - L'identifiant du type de dépense à supprimer
 * @returns Un objet avec success (boolean), message (string) en cas de succès, ou error (string) en cas d'échec
 */
export async function deleteTypeDepense(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier si le type est utilisé dans des dépenses
    const depensesCount = await prisma.depense.count({
      where: {
        typeDepenseId: id
      }
    });

    if (depensesCount > 0) {
      return { success: false, error: `Impossible de supprimer ce type car il est utilisé dans ${depensesCount} dépense(s)` };
    }

    await prisma.typeDepense.delete({
      where: { id }
    });

    revalidatePath("/admin/depenses");
    revalidatePath("/admin/depenses/types");

    return { success: true, message: "Type de dépense supprimé avec succès" };

  } catch (error) {
    console.error("Erreur lors de la suppression du type de dépense:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

/**
 * Récupère un type de dépense par son ID
 * 
 * @param id - L'identifiant du type de dépense
 * @returns Un objet avec success (boolean), data (TypeDepense) en cas de succès, ou error (string) en cas d'échec
 */
export async function getTypeDepenseById(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
      return { success: false, error: "Non autorisé" };
    }

    const typeDepense = await prisma.typeDepense.findUnique({
      where: { id },
      include: {
        CreatedBy: {
          select: {
            id: true,
            email: true,
          }
        },
        _count: {
          select: {
            Depenses: true,
          }
        }
      }
    });

    if (!typeDepense) {
      return { success: false, error: "Type de dépense non trouvé" };
    }

    return { success: true, data: typeDepense };

  } catch (error) {
    console.error("Erreur lors de la récupération du type de dépense:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

