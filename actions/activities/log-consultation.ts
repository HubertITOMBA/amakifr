"use server";

import { logConsultation } from "@/lib/activity-logger";

/**
 * Action serveur pour logger la consultation d'une page
 * Utilisée par le hook useActivityLogger côté client
 * 
 * @param pageName - Nom de la page consultée
 * @param entityType - Type d'entité principal de la page (optionnel)
 */
export async function logPageConsultation(pageName: string, entityType?: string) {
  try {
    await logConsultation(
      `Consultation de la page: ${pageName}`,
      entityType,
      undefined,
      {
        pageName,
        timestamp: new Date().toISOString(),
      }
    );
  } catch (error) {
    // Ne pas bloquer l'affichage de la page si le logging échoue
    console.error("Erreur lors du logging de la consultation:", error);
  }
}
