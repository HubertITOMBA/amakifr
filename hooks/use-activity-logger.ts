"use client";

import { useEffect } from "react";
import { logPageConsultation } from "@/actions/activities/log-consultation";

/**
 * Hook pour logger automatiquement la consultation d'une page
 * 
 * @param pageName - Nom de la page consultée
 * @param entityType - Type d'entité principal de la page (optionnel)
 */
export function useActivityLogger(pageName: string, entityType?: string) {
  useEffect(() => {
    // Logger la consultation de la page via une action serveur
    logPageConsultation(pageName, entityType).catch((error) => {
      // Ne pas bloquer l'affichage de la page si le logging échoue
      console.error("Erreur lors du logging de la consultation:", error);
    });
  }, [pageName, entityType]);
}
