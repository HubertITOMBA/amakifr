"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { revalidatePath } from "next/cache";

// Schéma de validation pour un poste
const PosteTemplateSchema = z.object({
  code: z.string().min(1, "Le code est requis").max(100, "Le code ne peut pas dépasser 100 caractères"),
  libelle: z.string().min(1, "Le libellé est requis").max(255, "Le libellé ne peut pas dépasser 255 caractères"),
  description: z.string().optional(),
  ordre: z.number().int().default(0),
  actif: z.boolean().default(true),
  nombreMandatsDefaut: z.number().int().min(1).default(1),
  dureeMandatDefaut: z.number().int().optional(),
});

const UpdatePosteTemplateSchema = PosteTemplateSchema.partial().extend({
  code: z.string().min(1).max(100).optional(),
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

    // Vérifier que le code n'existe pas déjà
    const existingPoste = await prisma.posteTemplate.findUnique({
      where: { code: validatedData.code },
    });

    if (existingPoste) {
      return { success: false, error: "Un poste avec ce code existe déjà" };
    }

    // Créer le poste
    const poste = await prisma.posteTemplate.create({
      data: {
        ...validatedData,
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

    // Si le code est modifié, vérifier qu'il n'existe pas déjà
    if (validatedData.code && validatedData.code !== existingPoste.code) {
      const codeExists = await prisma.posteTemplate.findUnique({
        where: { code: validatedData.code },
      });

      if (codeExists) {
        return { success: false, error: "Un poste avec ce code existe déjà" };
      }
    }

    // Mettre à jour le poste
    const poste = await prisma.posteTemplate.update({
      where: { id },
      data: validatedData,
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

