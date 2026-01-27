"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { z } from "zod";

/**
 * Schéma de validation pour créer un rapport de réunion
 */
const CreateRapportReunionSchema = z.object({
  titre: z.string().min(1, "Le titre est requis").max(255, "Le titre est trop long"),
  dateReunion: z.string().transform((str) => new Date(str)),
  contenu: z.string().min(1, "Le contenu est requis"),
});

/**
 * Schéma de validation pour modifier un rapport de réunion
 */
const UpdateRapportReunionSchema = z.object({
  id: z.string().min(1, "L'ID est requis"),
  titre: z.string().min(1, "Le titre est requis").max(255, "Le titre est trop long"),
  dateReunion: z.string().transform((str) => new Date(str)),
  contenu: z.string().min(1, "Le contenu est requis"),
});

/**
 * Crée un nouveau rapport de réunion
 * 
 * @param formData - Les données du formulaire contenant les champs du rapport
 * @returns Un objet avec success (boolean), message (string) en cas de succès, 
 * ou error (string) en cas d'échec, et id (string) du rapport créé
 */
export async function createRapportReunion(formData: FormData) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que l'utilisateur est admin
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "ADMIN") {
      return { success: false, error: "Accès réservé aux administrateurs" };
    }

    const rawData = {
      titre: formData.get("titre") as string,
      dateReunion: formData.get("dateReunion") as string,
      contenu: formData.get("contenu") as string,
    };

    const validatedData = CreateRapportReunionSchema.parse(rawData);

    // Créer le rapport
    const rapport = await db.rapportReunion.create({
      data: {
        titre: validatedData.titre,
        dateReunion: validatedData.dateReunion,
        contenu: validatedData.contenu,
        createdBy: session.user.id,
      },
    });

    return {
      success: true,
      message: "Rapport de réunion créé avec succès",
      id: rapport.id,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors de la création du rapport:", error);
    return { success: false, error: "Erreur lors de la création du rapport" };
  } finally {
    revalidatePath("/admin/rapports-reunion");
    revalidatePath("/rapports-reunion");
  }
}

/**
 * Modifie un rapport de réunion existant
 * 
 * @param formData - Les données du formulaire contenant les champs du rapport
 * @returns Un objet avec success (boolean), message (string) en cas de succès, 
 * ou error (string) en cas d'échec
 */
export async function updateRapportReunion(formData: FormData) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que l'utilisateur est admin
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "ADMIN") {
      return { success: false, error: "Accès réservé aux administrateurs" };
    }

    const rawData = {
      id: formData.get("id") as string,
      titre: formData.get("titre") as string,
      dateReunion: formData.get("dateReunion") as string,
      contenu: formData.get("contenu") as string,
    };

    const validatedData = UpdateRapportReunionSchema.parse(rawData);

    // Vérifier que le rapport existe
    const existingRapport = await db.rapportReunion.findUnique({
      where: { id: validatedData.id },
    });

    if (!existingRapport) {
      return { success: false, error: "Rapport non trouvé" };
    }

    // Mettre à jour le rapport
    await db.rapportReunion.update({
      where: { id: validatedData.id },
      data: {
        titre: validatedData.titre,
        dateReunion: validatedData.dateReunion,
        contenu: validatedData.contenu,
        updatedBy: session.user.id,
      },
    });

    return {
      success: true,
      message: "Rapport de réunion modifié avec succès",
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors de la modification du rapport:", error);
    return { success: false, error: "Erreur lors de la modification du rapport" };
  } finally {
    revalidatePath("/admin/rapports-reunion");
    revalidatePath("/rapports-reunion");
  }
}

/**
 * Supprime un rapport de réunion
 * 
 * @param rapportId - L'ID du rapport à supprimer
 * @returns Un objet avec success (boolean), message (string) en cas de succès, 
 * ou error (string) en cas d'échec
 */
export async function deleteRapportReunion(rapportId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que l'utilisateur est admin
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "ADMIN") {
      return { success: false, error: "Accès réservé aux administrateurs" };
    }

    // Vérifier que le rapport existe
    const rapport = await db.rapportReunion.findUnique({
      where: { id: rapportId },
    });

    if (!rapport) {
      return { success: false, error: "Rapport non trouvé" };
    }

    // Supprimer le rapport
    await db.rapportReunion.delete({
      where: { id: rapportId },
    });

    return {
      success: true,
      message: "Rapport de réunion supprimé avec succès",
    };
  } catch (error) {
    console.error("Erreur lors de la suppression du rapport:", error);
    return { success: false, error: "Erreur lors de la suppression du rapport" };
  } finally {
    revalidatePath("/admin/rapports-reunion");
    revalidatePath("/rapports-reunion");
  }
}

/**
 * Récupère tous les rapports de réunion (pour les admins)
 * 
 * @returns Un objet avec success (boolean), rapports (array) en cas de succès, 
 * ou error (string) en cas d'échec
 */
export async function getAllRapportsReunion() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Autoriser les rôles admin qui ont accès aux rapports de réunion
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!user) {
      return { success: false, error: "Utilisateur non trouvé" };
    }

    const adminRoles = ['ADMIN', 'PRESID', 'VICEPR', 'SECRET', 'VICESE', 'COMCPT', 'TRESOR', 'VTRESO'];
    const normalizedRole = user.role?.toString().trim().toUpperCase();
    if (!normalizedRole || !adminRoles.includes(normalizedRole)) {
      return { success: false, error: "Accès refusé. Vous devez avoir un rôle d'administration." };
    }

    const rapports = await db.rapportReunion.findMany({
      orderBy: {
        dateReunion: "desc",
      },
      include: {
        CreatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        UpdatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return {
      success: true,
      rapports,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des rapports:", error);
    return {
      success: false,
      error: "Erreur lors de la récupération des rapports",
    };
  }
}

/**
 * Récupère un rapport de réunion par son ID
 * 
 * @param rapportId - L'ID du rapport à récupérer
 * @returns Un objet avec success (boolean), rapport (object) en cas de succès, 
 * ou error (string) en cas d'échec
 */
export async function getRapportReunionById(rapportId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const rapport = await db.rapportReunion.findUnique({
      where: { id: rapportId },
      include: {
        CreatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        UpdatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!rapport) {
      return { success: false, error: "Rapport non trouvé" };
    }

    return {
      success: true,
      rapport,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération du rapport:", error);
    return {
      success: false,
      error: "Erreur lors de la récupération du rapport",
    };
  }
}

/**
 * Récupère tous les rapports de réunion pour les adhérents (lecture seule)
 * 
 * @returns Un objet avec success (boolean), rapports (array) en cas de succès, 
 * ou error (string) en cas d'échec
 */
export async function getRapportsReunionForAdherents() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const rapports = await db.rapportReunion.findMany({
      orderBy: {
        dateReunion: "desc",
      },
      select: {
        id: true,
        titre: true,
        dateReunion: true,
        contenu: true,
        createdAt: true,
        CreatedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      success: true,
      rapports,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des rapports:", error);
    return {
      success: false,
      error: "Erreur lors de la récupération des rapports",
    };
  }
}
