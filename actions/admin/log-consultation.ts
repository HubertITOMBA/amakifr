"use server";

import { logConsultation } from "@/lib/activity-logger";

/**
 * Log une consultation de page (appelée depuis le client)
 * 
 * @param pageName - Nom de la page consultée
 * @param entityType - Type d'entité (optionnel)
 */
export async function logPageConsultation(pageName: string, entityType?: string) {
  try {
    await logConsultation(
      `Consultation de la page: ${pageName}`,
      entityType,
      undefined,
      {
        pageName,
      }
    );
  } catch (error) {
    console.error("Erreur lors du logging de la consultation:", error);
    // Ne pas bloquer si le logging échoue
  }
}
