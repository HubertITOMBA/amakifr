"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { UserRole, CategorieTypeCotisation } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const CreatePassAssistanceSchema = z.object({
  description: z.string().min(1, "La description est requise").max(500),
  montant: z.number().min(0, "Le montant doit être positif"),
  typeCotisationId: z.string().min(1, "Le type de cotisation (Assistance) est requis"),
});

const UpdatePassAssistanceSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1, "La description est requise").max(500),
  montant: z.number().min(0, "Le montant doit être positif"),
  typeCotisationId: z.string().min(1, "Le type de cotisation (Assistance) est requis"),
});

/**
 * Récupère la liste des PassAssistance + les types de cotisation mensuelle de catégorie Assistance.
 */
export async function getAssistanceSettingsData() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
      return { success: false, error: "Non autorisé. Admin requis." };
    }

    const passAssistances = await db.passAssistance.findMany({
      select: {
        id: true,
        description: true,
        montant: true,
        typeCotisationId: true,
        createdAt: true,
        updatedAt: true,
        TypeCotisationMensuelle: {
          select: { id: true, nom: true, categorie: true, actif: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const typesCotisationAssistance = await db.typeCotisationMensuelle.findMany({
      where: { categorie: CategorieTypeCotisation.Assistance, actif: true },
      select: { id: true, nom: true },
      orderBy: { nom: "asc" },
    });

    const serialized = passAssistances.map((p) => {
      const createdAt =
        p.createdAt instanceof Date
          ? p.createdAt.toISOString()
          : typeof p.createdAt === "string"
            ? p.createdAt
            : "";
      const updatedAt =
        p.updatedAt instanceof Date
          ? p.updatedAt.toISOString()
          : typeof p.updatedAt === "string"
            ? p.updatedAt
            : "";
      return {
        id: p.id,
        description: p.description,
        montant: Number(p.montant),
        typeCotisationId: p.typeCotisationId,
        createdAt,
        updatedAt,
        TypeCotisationMensuelle: p.TypeCotisationMensuelle
          ? {
              id: p.TypeCotisationMensuelle.id,
              nom: p.TypeCotisationMensuelle.nom,
              categorie: p.TypeCotisationMensuelle.categorie,
              actif: p.TypeCotisationMensuelle.actif,
            }
          : null,
      };
    });

    return {
      success: true,
      data: {
        passAssistances: serialized,
        typesCotisationAssistance,
      },
    };
  } catch (error) {
    console.error("Erreur getAssistanceSettingsData:", error);
    return { success: false, error: "Erreur serveur" };
  }
}

/**
 * Crée une configuration PassAssistance (une par type de cotisation Assistance).
 */
export async function createPassAssistance(data: z.infer<typeof CreatePassAssistanceSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
      return { success: false, error: "Non autorisé. Admin requis." };
    }

    const validated = CreatePassAssistanceSchema.parse(data);

    const existing = await db.passAssistance.findFirst({
      where: { typeCotisationId: validated.typeCotisationId },
    });
    if (existing) {
      return { success: false, error: "Une assistance existe déjà pour ce type de cotisation." };
    }

    const saved = await db.passAssistance.create({
      data: {
        description: validated.description,
        montant: validated.montant,
        typeCotisationId: validated.typeCotisationId,
      },
      include: {
        TypeCotisationMensuelle: {
          select: { id: true, nom: true, categorie: true, actif: true },
        },
      },
    });

    revalidatePath("/admin/settings");

    return {
      success: true,
      data: {
        ...saved,
        montant: Number(saved.montant),
        typeCotisationId: saved.typeCotisationId,
      },
      message: "Configuration assistance créée",
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0]?.message || "Données invalides" };
    }
    console.error("Erreur createPassAssistance:", error);
    return { success: false, error: "Erreur serveur" };
  }
}

/**
 * Met à jour une configuration PassAssistance.
 */
export async function updatePassAssistance(data: z.infer<typeof UpdatePassAssistanceSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
      return { success: false, error: "Non autorisé. Admin requis." };
    }

    const validated = UpdatePassAssistanceSchema.parse(data);

    const saved = await db.passAssistance.update({
      where: { id: validated.id },
      data: {
        description: validated.description,
        montant: validated.montant,
        typeCotisationId: validated.typeCotisationId,
      },
      include: {
        TypeCotisationMensuelle: {
          select: { id: true, nom: true, categorie: true, actif: true },
        },
      },
    });

    revalidatePath("/admin/settings");

    return {
      success: true,
      data: {
        ...saved,
        montant: Number(saved.montant),
        typeCotisationId: saved.typeCotisationId,
      },
      message: "Configuration assistance sauvegardée",
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0]?.message || "Données invalides" };
    }
    console.error("Erreur updatePassAssistance:", error);
    return { success: false, error: "Erreur serveur" };
  }
}

/**
 * Crée ou met à jour une configuration PassAssistance (pour l'UI).
 */
export async function upsertPassAssistance(data: {
  id?: string;
  description: string;
  montant: number;
  typeCotisationId: string;
}) {
  if (data.id) {
    return updatePassAssistance({
      id: data.id,
      description: data.description,
      montant: data.montant,
      typeCotisationId: data.typeCotisationId,
    });
  }
  return createPassAssistance({
    description: data.description,
    montant: data.montant,
    typeCotisationId: data.typeCotisationId,
  });
}

/**
 * Supprime une configuration PassAssistance.
 */
export async function deletePassAssistance(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
      return { success: false, error: "Non autorisé. Admin requis." };
    }

    await db.passAssistance.delete({
      where: { id },
    });

    revalidatePath("/admin/settings");

    return { success: true, message: "Configuration assistance supprimée" };
  } catch (error) {
    console.error("Erreur deletePassAssistance:", error);
    return { success: false, error: "Erreur serveur" };
  }
}

