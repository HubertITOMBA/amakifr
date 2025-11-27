"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { z } from "zod";

const CompleteProfileSchema = z.object({
    anneePromotion: z.string().optional(),
    pays: z.string().optional(),
    ville: z.string().optional(),
    profession: z.string().optional(),
    centresInteret: z.string().optional(),
});

/**
 * Complète le profil de l'adhérent avec les informations optionnelles
 * 
 * @param data - Les données du formulaire de complétion de profil
 * @returns Un objet avec success (boolean) et message (string) ou error (string)
 */
export async function completeProfile(data: z.infer<typeof CompleteProfileSchema>) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Non autorisé" };
        }

        const validatedData = CompleteProfileSchema.parse(data);

        // Récupérer l'adhérent
        const adherent = await db.adherent.findUnique({
            where: { userId: session.user.id },
        });

        if (!adherent) {
            return { success: false, error: "Profil adhérent non trouvé" };
        }

        // Préparer les données pour centresInteret (pays et ville en JSON)
        const infoSupplementaires: {
            pays?: string;
            ville?: string;
        } = {};
        
        if (validatedData.pays) infoSupplementaires.pays = validatedData.pays;
        if (validatedData.ville) infoSupplementaires.ville = validatedData.ville;

        // Mettre à jour l'adhérent
        await db.adherent.update({
            where: { id: adherent.id },
            data: {
                anneePromotion: validatedData.anneePromotion || null,
                profession: validatedData.profession || null,
                centresInteret: Object.keys(infoSupplementaires).length > 0 
                    ? JSON.stringify(infoSupplementaires) 
                    : (validatedData.centresInteret || null),
            },
        });

        return { 
            success: true, 
            message: "Profil complété avec succès !" 
        };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error: error.errors[0].message };
        }
        console.error("Erreur lors de la complétion du profil:", error);
        return { success: false, error: "Erreur lors de la sauvegarde du profil" };
    }
}

