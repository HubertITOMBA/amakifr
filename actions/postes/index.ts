"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { revalidatePath } from "next/cache";

// Fonction pour générer un code unique de 6 caractères
async function generateUniqueCode(libelle: string): Promise<string> {
  // Normaliser le libellé : enlever accents, mettre en majuscules
  const normalized = libelle
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "");
  
  // Prendre les premières lettres du libellé (max 6)
  let base = normalized.substring(0, 6);
  
  // Compléter jusqu'à 6 caractères avec des caractères aléatoires si nécessaire
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  while (base.length < 6) {
    base += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  // Vérifier l'unicité et régénérer si nécessaire
  let attempts = 0;
  let code = base;
  while (attempts < 100) {
    const existing = await prisma.posteTemplate.findUnique({
      where: { code },
    });
    
    if (!existing) {
      return code;
    }
    
    // Générer un nouveau code complètement aléatoire
    code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    attempts++;
  }
  
  // Fallback : code aléatoire complet (ne devrait jamais arriver ici)
  code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Schéma de validation pour un poste
const PosteTemplateSchema = z.object({
  code: z.string().length(6, "Le code doit contenir exactement 6 caractères").optional(),
  libelle: z.string().min(1, "Le libellé est requis").max(255, "Le libellé ne peut pas dépasser 255 caractères"),
  description: z.string().optional(),
  ordre: z.number().int().default(0),
  actif: z.boolean().default(true),
  nombreMandatsDefaut: z.number().int().min(1).default(1),
  dureeMandatDefaut: z.number().int().optional(),
});

const UpdatePosteTemplateSchema = PosteTemplateSchema.partial().extend({
  code: z.string().length(6, "Le code doit contenir exactement 6 caractères").optional(),
});

// Types TypeScript
export interface PosteTemplateData {
  id: string;
  code: string;
  libelle: string;
  description?: string;
  ordre: number;
  actif: boolean;
  nombreMandatsDefaut: number;
  dureeMandatDefaut?: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

/**
 * Récupérer tous les postes (actifs ou tous)
 */
export async function getAllPostesTemplates(actifsSeulement: boolean = false) {
  try {
    const where = actifsSeulement ? { actif: true } : {};
    
    const postes = await prisma.posteTemplate.findMany({
      where,
      orderBy: [
        { ordre: "asc" },
        { libelle: "asc" },
      ],
      include: {
        CreatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            positions: true,
          },
        },
      },
    });

    return { success: true, data: postes };
  } catch (error) {
    console.error("Erreur lors de la récupération des postes:", error);
    return { success: false, error: "Erreur lors de la récupération des postes" };
  }
}

/**
 * Récupérer un poste par son ID
 */
export async function getPosteTemplateById(id: string) {
  try {
    const poste = await prisma.posteTemplate.findUnique({
      where: { id },
      include: {
        CreatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            positions: true,
          },
        },
      },
    });

    if (!poste) {
      return { success: false, error: "Poste non trouvé" };
    }

    return { success: true, data: poste };
  } catch (error) {
    console.error("Erreur lors de la récupération du poste:", error);
    return { success: false, error: "Erreur lors de la récupération du poste" };
  }
}

/**
 * Récupérer un poste par son code
 */
export async function getPosteTemplateByCode(code: string) {
  try {
    const poste = await prisma.posteTemplate.findUnique({
      where: { code },
      include: {
        CreatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!poste) {
      return { success: false, error: "Poste non trouvé" };
    }

    return { success: true, data: poste };
  } catch (error) {
    console.error("Erreur lors de la récupération du poste:", error);
    return { success: false, error: "Erreur lors de la récupération du poste" };
  }
}

/**
 * Créer un nouveau poste
 */
export async function createPosteTemplate(data: z.infer<typeof PosteTemplateSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que l'utilisateur est admin
    if (session.user.role !== "Admin") {
      return { success: false, error: "Seuls les administrateurs peuvent créer des postes" };
    }

    const validatedData = PosteTemplateSchema.parse(data);

    // Générer automatiquement le code si non fourni
    let codeToUse = validatedData.code;
    if (!codeToUse || codeToUse.length !== 6) {
      codeToUse = await generateUniqueCode(validatedData.libelle);
    }

    // Vérifier que le code n'existe pas déjà
    const existingPoste = await prisma.posteTemplate.findUnique({
      where: { code: codeToUse },
    });

    if (existingPoste) {
      // Régénérer un nouveau code si collision
      codeToUse = await generateUniqueCode(validatedData.libelle);
      const secondCheck = await prisma.posteTemplate.findUnique({
        where: { code: codeToUse },
      });
      if (secondCheck) {
        return { success: false, error: "Impossible de générer un code unique. Veuillez réessayer." };
      }
    }

    // Créer le poste
    const poste = await prisma.posteTemplate.create({
      data: {
        ...validatedData,
        code: codeToUse,
        createdBy: session.user.id,
      },
      include: {
        CreatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    revalidatePath("/admin/postes");
    revalidatePath("/admin/elections");

    return { success: true, data: poste };
  } catch (error) {
    console.error("Erreur lors de la création du poste:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: "Erreur lors de la création du poste" };
  }
}

/**
 * Mettre à jour un poste
 */
export async function updatePosteTemplate(
  id: string,
  data: z.infer<typeof UpdatePosteTemplateSchema>
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que l'utilisateur est admin
    if (session.user.role !== "Admin") {
      return { success: false, error: "Seuls les administrateurs peuvent modifier des postes" };
    }

    // Vérifier que le poste existe
    const existingPoste = await prisma.posteTemplate.findUnique({
      where: { id },
    });

    if (!existingPoste) {
      return { success: false, error: "Poste non trouvé" };
    }

    const validatedData = UpdatePosteTemplateSchema.parse(data);

    // Le code ne peut pas être modifié après la création
    // Retirer le code des données à mettre à jour
    const { code, ...updateData } = validatedData;

    // Mettre à jour le poste (sans le code)
    const poste = await prisma.posteTemplate.update({
      where: { id },
      data: updateData,
      include: {
        CreatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    revalidatePath("/admin/postes");
    revalidatePath(`/admin/postes/${id}`);
    revalidatePath("/admin/elections");

    return { success: true, data: poste };
  } catch (error) {
    console.error("Erreur lors de la mise à jour du poste:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: "Erreur lors de la mise à jour du poste" };
  }
}

/**
 * Supprimer un poste
 */
export async function deletePosteTemplate(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que l'utilisateur est admin
    if (session.user.role !== "Admin") {
      return { success: false, error: "Seuls les administrateurs peuvent supprimer des postes" };
    }

    // Vérifier que le poste existe
    const poste = await prisma.posteTemplate.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            positions: true,
          },
        },
      },
    });

    if (!poste) {
      return { success: false, error: "Poste non trouvé" };
    }

    // Vérifier qu'aucune position n'utilise ce poste
    if (poste._count.positions > 0) {
      return {
        success: false,
        error: `Ce poste ne peut pas être supprimé car il est utilisé par ${poste._count.positions} position(s) dans des élections. Désactivez-le plutôt.`,
      };
    }

    // Supprimer le poste
    await prisma.posteTemplate.delete({
      where: { id },
    });

    revalidatePath("/admin/postes");
    revalidatePath("/admin/elections");

    return { success: true };
  } catch (error) {
    console.error("Erreur lors de la suppression du poste:", error);
    return { success: false, error: "Erreur lors de la suppression du poste" };
  }
}

/**
 * Activer/désactiver un poste
 */
export async function togglePosteTemplateStatus(id: string, actif: boolean) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que l'utilisateur est admin
    if (session.user.role !== "Admin") {
      return { success: false, error: "Seuls les administrateurs peuvent modifier le statut des postes" };
    }

    const poste = await prisma.posteTemplate.update({
      where: { id },
      data: { actif },
      include: {
        CreatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    revalidatePath("/admin/postes");
    revalidatePath("/admin/elections");

    return { success: true, data: poste };
  } catch (error) {
    console.error("Erreur lors de la modification du statut du poste:", error);
    return { success: false, error: "Erreur lors de la modification du statut du poste" };
  }
}

