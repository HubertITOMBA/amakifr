"use server"

import { signOut } from "@/auth"
import { auth } from "@/auth"
import { logUserActivity, TypeActivite } from "@/lib/activity-logger"

export const logOut = async () => {
    try {
        // Récupérer la session avant la déconnexion pour le logging
        const session = await auth();
        
        // Logger la déconnexion si une session existe
        if (session?.user?.id) {
            try {
                await logUserActivity(
                    TypeActivite.Deconnexion,
                    `Déconnexion de l'utilisateur ${session.user.email || session.user.name || session.user.id}`,
                    "User",
                    session.user.id,
                    {
                        email: session.user.email,
                        role: session.user.role,
                    }
                );
            } catch (logError) {
                console.error("Erreur lors du logging de la déconnexion:", logError);
                // Ne pas bloquer la déconnexion si le logging échoue
            }
        }
    } catch (error) {
        console.error("Erreur lors de la récupération de la session pour le logging:", error);
        // Continuer la déconnexion même si le logging échoue
    }
    
    // Effectuer la déconnexion
    await signOut()
}