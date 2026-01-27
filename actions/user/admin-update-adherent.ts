"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logModification } from "@/lib/activity-logger";

/**
 * Schéma de validation pour la mise à jour d'un adhérent par un admin
 */
const AdminUpdateAdherentSchema = z.object({
  civility: z.enum(["Monsieur", "Madame", "Mademoiselle"]).optional(),
  firstname: z.string().min(1, "Le prénom est requis").max(255).optional(),
  lastname: z.string().min(1, "Le nom est requis").max(255).optional(),
  dateNaissance: z.string().nullable().optional(),
  typeAdhesion: z.enum(["AdhesionAnnuelle", "Renouvellement", "Autre"]).nullable().optional(),
  profession: z.string().max(255).nullable().optional(),
  centresInteret: z.string().nullable().optional(),
  autorisationImage: z.boolean().optional(),
  accepteCommunications: z.boolean().optional(),
  nombreEnfants: z.number().int().min(0).optional(),
  posteTemplateId: z.string().nullable().optional(),
});

/**
 * Met à jour les informations d'un adhérent (admin uniquement)
 * 
 * @param adherentId - L'ID de l'adhérent à mettre à jour
 * @param data - Les données à mettre à jour
 * @returns Un objet avec success (boolean) et message (string) ou error (string)
 */
export async function adminUpdateAdherent(
  adherentId: string,
  data: z.infer<typeof AdminUpdateAdherentSchema>
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const user = await db.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.role !== "ADMIN") {
      return { success: false, error: "Admin requis" };
    }

    // Vérifier que l'adhérent existe
    const adherent = await db.adherent.findUnique({
      where: { id: adherentId },
    });

    if (!adherent) {
      return { success: false, error: "Adhérent non trouvé" };
    }

    // Valider les données
    const validatedData = AdminUpdateAdherentSchema.parse(data);

    // Préparer les données de mise à jour
    const updateData: any = {};

    if (validatedData.civility !== undefined) {
      updateData.civility = validatedData.civility;
    }
    if (validatedData.firstname !== undefined) {
      updateData.firstname = validatedData.firstname;
    }
    if (validatedData.lastname !== undefined) {
      updateData.lastname = validatedData.lastname;
    }
    if (validatedData.dateNaissance !== undefined) {
      updateData.dateNaissance = validatedData.dateNaissance 
        ? new Date(validatedData.dateNaissance) 
        : null;
    }
    if (validatedData.typeAdhesion !== undefined) {
      updateData.typeAdhesion = validatedData.typeAdhesion;
    }
    if (validatedData.profession !== undefined) {
      updateData.profession = validatedData.profession;
    }
    if (validatedData.centresInteret !== undefined) {
      updateData.centresInteret = validatedData.centresInteret;
    }
    if (validatedData.autorisationImage !== undefined) {
      updateData.autorisationImage = validatedData.autorisationImage;
    }
    if (validatedData.accepteCommunications !== undefined) {
      updateData.accepteCommunications = validatedData.accepteCommunications;
    }
    if (validatedData.nombreEnfants !== undefined) {
      updateData.nombreEnfants = validatedData.nombreEnfants;
    }
    if (validatedData.posteTemplateId !== undefined) {
      // Si un poste est spécifié, vérifier qu'il existe et est actif
      if (validatedData.posteTemplateId) {
        const poste = await db.posteTemplate.findUnique({
          where: { id: validatedData.posteTemplateId },
        });

        if (!poste) {
          return { success: false, error: "Poste non trouvé" };
        }

        if (!poste.actif) {
          return { success: false, error: "Ce poste n'est pas actif" };
        }
      }
      updateData.posteTemplateId = validatedData.posteTemplateId;
    }

    // Mettre à jour l'adhérent
    await db.adherent.update({
      where: { id: adherentId },
      data: updateData,
    });

    // Logger l'activité
    try {
      await logModification(
        `Modification de l'adhérent ${adherent.firstname} ${adherent.lastname}`,
        "Adherent",
        adherentId,
        {
          fieldsUpdated: Object.keys(updateData),
        }
      );
    } catch (logError) {
      console.error("Erreur lors du logging de l'activité:", logError);
      // Ne pas bloquer la mise à jour si le logging échoue
    }

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${adherent.userId}/consultation`);
    revalidatePath(`/admin/users/${adherent.userId}/edition`);

    return { success: true, message: "Adhérent mis à jour avec succès" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur adminUpdateAdherent:", error);
    return { success: false, error: "Erreur lors de la mise à jour de l'adhérent" };
  }
}

