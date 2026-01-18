// Server Actions pour la gestion des dépenses
"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { logCreation, logModification } from "@/lib/activity-logger";

// Fonction helper pour transformer null/empty en undefined
const nullishToString = z.preprocess(
  (val) => (val === null || val === "" || val === undefined ? undefined : val),
  z.string().optional()
);

// Schémas de validation
const CreateDepenseSchema = z.object({
  libelle: z.string().min(1, "Le libellé est requis"),
  montant: z.number().min(0, "Le montant doit être positif"),
  dateDepense: z.string().min(1, "La date est requise"),
  typeDepenseId: nullishToString, // ID du type de dépense
  categorie: nullishToString, // Conservé pour compatibilité
  description: nullishToString,
  justificatif: nullishToString, // URL du fichier uploadé
  statut: z.enum(["EnAttente", "Valide", "Rejete"]).default("EnAttente"),
});

const UpdateDepenseSchema = z.object({
  id: z.string().min(1, "ID requis"),
  libelle: z.string().optional(),
  montant: z.number().min(0).optional(),
  dateDepense: z.string().optional(),
  typeDepenseId: z.string().optional().nullable(),
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
        typeDepenseId: validatedData.typeDepenseId || null,
        categorie: validatedData.categorie || null,
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
        },
        TypeDepense: {
          select: {
            id: true,
            titre: true,
            description: true,
          }
        }
      }
    });

    // Convertir les Decimal en Number
    const depenseConverted = {
      ...depense,
      montant: Number(depense.montant)
    };

    revalidatePath("/admin/depenses");
    revalidatePath("/admin/depenses/gestion");

    // Logger l'activité
    try {
      await logCreation(
        `Création de la dépense: ${validatedData.libelle}`,
        "Depense",
        depense.id,
        {
          montant: validatedData.montant,
          statut: validatedData.statut,
          typeDepenseId: validatedData.typeDepenseId,
        }
      );
    } catch (logError) {
      console.error("Erreur lors du logging de l'activité:", logError);
      // Ne pas bloquer la création si le logging échoue
    }

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
        },
        TypeDepense: {
          select: {
            id: true,
            titre: true,
            description: true,
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

    // Vérifier que la dépense existe et n'est pas validée ou rejetée
    const existingDepense = await prisma.depense.findUnique({
      where: { id: data.id },
      select: { statut: true }
    });

    if (!existingDepense) {
      return { success: false, error: "Dépense non trouvée" };
    }

    if (existingDepense.statut === "Valide" || existingDepense.statut === "Rejete") {
      return { success: false, error: "Une dépense validée ou rejetée ne peut plus être modifiée" };
    }

    const validatedData = UpdateDepenseSchema.parse(data);

    const depense = await prisma.depense.update({
      where: { id: validatedData.id },
      data: {
        libelle: validatedData.libelle,
        montant: validatedData.montant,
        dateDepense: validatedData.dateDepense ? new Date(validatedData.dateDepense) : undefined,
        typeDepenseId: validatedData.typeDepenseId !== undefined ? validatedData.typeDepenseId : undefined,
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
        },
        TypeDepense: {
          select: {
            id: true,
            titre: true,
            description: true,
          }
        }
      }
    });

    // Convertir les Decimal en Number
    const depenseConverted = {
      ...depense,
      montant: Number(depense.montant)
    };

    // Logger l'activité
    try {
      await logModification(
        `Modification de la dépense: ${validatedData.libelle || existingDepense.statut}`,
        "Depense",
        validatedData.id,
        {
          fieldsUpdated: Object.keys(validatedData).filter(key => key !== 'id'),
          statut: validatedData.statut || existingDepense.statut,
        }
      );
    } catch (logError) {
      console.error("Erreur lors du logging de l'activité:", logError);
      // Ne pas bloquer la mise à jour si le logging échoue
    }

    revalidatePath("/admin/depenses");

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

    // Vérifier que la dépense existe et n'est pas validée ou rejetée
    const existingDepense = await prisma.depense.findUnique({
      where: { id },
      select: { statut: true }
    });

    if (!existingDepense) {
      return { success: false, error: "Dépense non trouvée" };
    }

    if (existingDepense.statut === "Valide" || existingDepense.statut === "Rejete") {
      return { success: false, error: "Une dépense validée ou rejetée ne peut plus être supprimée" };
    }

    // Récupérer les informations de la dépense avant suppression pour le logging
    const depenseInfo = await prisma.depense.findUnique({
      where: { id },
      select: { libelle: true, montant: true },
    });

    await prisma.depense.delete({
      where: { id }
    });

    // Logger l'activité
    try {
      await logDeletion(
        `Suppression de la dépense: ${depenseInfo?.libelle || id}`,
        "Depense",
        id,
        {
          libelle: depenseInfo?.libelle,
          montant: depenseInfo?.montant ? Number(depenseInfo.montant) : null,
        }
      );
    } catch (logError) {
      console.error("Erreur lors du logging de l'activité:", logError);
      // Ne pas bloquer la suppression si le logging échoue
    }

    revalidatePath("/admin/depenses");

    return { success: true, message: "Dépense supprimée avec succès" };

  } catch (error) {
    console.error("Erreur lors de la suppression de la dépense:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

/**
 * Valide une dépense
 * 
 * @param id - L'identifiant de la dépense à valider
 * @returns Un objet avec success (boolean), message (string) en cas de succès, ou error (string) en cas d'échec
 */
export async function validateDepense(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    await prisma.depense.update({
      where: { id },
      data: { statut: "Valide" }
    });

    revalidatePath("/admin/depenses");
    revalidatePath(`/admin/depenses/${id}/edition`);
    revalidatePath(`/admin/depenses/${id}/consultation`);

    return { success: true, message: "Dépense validée avec succès" };

  } catch (error) {
    console.error("Erreur lors de la validation de la dépense:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

/**
 * Rejette une dépense
 * 
 * @param id - L'identifiant de la dépense à rejeter
 * @returns Un objet avec success (boolean), message (string) en cas de succès, ou error (string) en cas d'échec
 */
export async function rejectDepense(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    await prisma.depense.update({
      where: { id },
      data: { statut: "Rejete" }
    });

    revalidatePath("/admin/depenses");
    revalidatePath(`/admin/depenses/${id}/edition`);
    revalidatePath(`/admin/depenses/${id}/consultation`);

    return { success: true, message: "Dépense rejetée avec succès" };

  } catch (error) {
    console.error("Erreur lors du rejet de la dépense:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

/**
 * Remet une dépense en attente
 * 
 * @param id - L'identifiant de la dépense à remettre en attente
 * @returns Un objet avec success (boolean), message (string) en cas de succès, ou error (string) en cas d'échec
 */
export async function suspendDepense(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    await prisma.depense.update({
      where: { id },
      data: { statut: "EnAttente" }
    });

    revalidatePath("/admin/depenses");
    revalidatePath(`/admin/depenses/${id}/edition`);
    revalidatePath(`/admin/depenses/${id}/consultation`);

    return { success: true, message: "Dépense remise en attente avec succès" };

  } catch (error) {
    console.error("Erreur lors de la suspension de la dépense:", error);
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

// Obtenir une dépense par ID
export async function getDepenseById(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const depense = await prisma.depense.findUnique({
      where: { id },
      include: {
        CreatedBy: {
          select: {
            id: true,
            email: true,
          }
        },
        TypeDepense: {
          select: {
            id: true,
            titre: true,
            description: true,
          }
        },
        Justificatifs: {
          include: {
            UploadedBy: {
              select: {
                id: true,
                email: true,
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!depense) {
      return { success: false, error: "Dépense non trouvée" };
    }

    // Convertir les Decimal en Number
    const depenseConverted = {
      ...depense,
      montant: Number(depense.montant),
      dateDepense: depense.dateDepense.toISOString().split('T')[0]
    };

    return { success: true, data: depenseConverted };

  } catch (error) {
    console.error("Erreur lors de la récupération de la dépense:", error);
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
        },
        TypeDepense: {
          select: {
            id: true,
            titre: true,
            description: true,
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

/**
 * Upload un justificatif pour une dépense
 * 
 * @param formData - FormData contenant le fichier (clé: "file") et depenseId (clé: "depenseId")
 * @returns Un objet avec success (boolean), data (justificatif créé) en cas de succès, ou error (string) en cas d'échec
 */
export async function uploadJustificatif(formData: FormData) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const file = formData.get("file") as File;
    const depenseId = formData.get("depenseId") as string;

    if (!file) {
      return { success: false, error: "Aucun fichier fourni" };
    }

    if (!depenseId) {
      return { success: false, error: "ID de dépense requis" };
    }

    // Vérifier que la dépense existe
    const depense = await prisma.depense.findUnique({
      where: { id: depenseId }
    });

    if (!depense) {
      return { success: false, error: "Dépense non trouvée" };
    }

    // Vérifier le type de fichier (PDF, images)
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/bmp"
    ];
    
    if (!allowedTypes.includes(file.type)) {
      return { success: false, error: "Type de fichier non autorisé. Formats acceptés: PDF, JPG, JPEG, PNG, GIF, WEBP, BMP" };
    }

    // Vérifier la taille (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return { success: false, error: "Le fichier est trop volumineux. Taille maximale: 10MB" };
    }

    // Générer un nom de fichier unique
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = file.name.split('.').pop()?.toLowerCase();
    const fileName = `justificatif_${timestamp}_${randomString}.${extension}`;

    // Créer le répertoire s'il n'existe pas
    const { writeFile, mkdir } = await import("fs/promises");
    const { join } = await import("path");
    const { existsSync } = await import("fs");
    const uploadDir = join(process.cwd(), "public", "ressources", "justificatifs");
    
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Sauvegarder le fichier
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filePath = join(uploadDir, fileName);
    await writeFile(filePath, buffer);

    // Créer l'enregistrement dans la base de données
    const justificatif = await prisma.justificatifDepense.create({
      data: {
        depenseId: depenseId,
        nomFichier: file.name,
        chemin: `/ressources/justificatifs/${fileName}`,
        typeMime: file.type,
        taille: file.size,
        uploadedBy: session.user.id,
      },
      include: {
        UploadedBy: {
          select: {
            id: true,
            email: true,
          }
        }
      }
    });

    revalidatePath("/admin/depenses");
    revalidatePath(`/admin/depenses/${depenseId}/edition`);

    return { 
      success: true, 
      data: {
        id: justificatif.id,
        nomFichier: justificatif.nomFichier,
        chemin: justificatif.chemin,
        typeMime: justificatif.typeMime,
        taille: justificatif.taille,
        createdAt: justificatif.createdAt,
      }
    };

  } catch (error) {
    console.error("Erreur lors de l'upload du justificatif:", error);
    return { success: false, error: "Erreur interne du serveur lors de l'upload" };
  }
}

/**
 * Supprime un justificatif
 * 
 * @param id - L'identifiant du justificatif à supprimer
 * @returns Un objet avec success (boolean), message (string) en cas de succès, ou error (string) en cas d'échec
 */
export async function deleteJustificatif(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    // Récupérer le justificatif pour obtenir le chemin du fichier
    const justificatif = await prisma.justificatifDepense.findUnique({
      where: { id },
      include: {
        Depense: true
      }
    });

    if (!justificatif) {
      return { success: false, error: "Justificatif non trouvé" };
    }

    // Supprimer le fichier physique
    try {
      const { unlink } = await import("fs/promises");
      const { join } = await import("path");
      const filePath = join(process.cwd(), "public", justificatif.chemin);
      await unlink(filePath);
    } catch (fileError) {
      console.error("Erreur lors de la suppression du fichier:", fileError);
      // Continuer même si le fichier n'existe pas
    }

    // Supprimer l'enregistrement de la base de données
    await prisma.justificatifDepense.delete({
      where: { id }
    });

    revalidatePath("/admin/depenses");
    revalidatePath(`/admin/depenses/${justificatif.depenseId}/edition`);

    return { success: true, message: "Justificatif supprimé avec succès" };

  } catch (error) {
    console.error("Erreur lors de la suppression du justificatif:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

/**
 * Récupère tous les justificatifs d'une dépense
 * 
 * @param depenseId - L'identifiant de la dépense
 * @returns Un objet avec success (boolean), data (justificatifs[]) en cas de succès, ou error (string) en cas d'échec
 */
export async function getJustificatifsByDepense(depenseId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const justificatifs = await prisma.justificatifDepense.findMany({
      where: { depenseId },
      include: {
        UploadedBy: {
          select: {
            id: true,
            email: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return { success: true, data: justificatifs };

  } catch (error) {
    console.error("Erreur lors de la récupération des justificatifs:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}
