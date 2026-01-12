"use client";

import { useState, useEffect } from "react";
import { getElectoralMenuStatus } from "@/actions/settings/electoral-menu";

/**
 * Hook pour récupérer l'état d'activation des menus électoraux
 * 
 * @returns enabled (boolean) - true si les menus doivent être affichés
 */
export function useElectoralMenu() {
  const [enabled, setEnabled] = useState(true); // Par défaut activé
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const result = await getElectoralMenuStatus();
        if (result.success) {
          setEnabled(result.enabled);
        }
      } catch (error) {
        console.error("Erreur lors de la récupération du statut des menus électoraux:", error);
        // En cas d'erreur, on garde activé par défaut
        setEnabled(true);
      } finally {
        setLoading(false);
      }
    }

    fetchStatus();
  }, []);

  return { enabled, loading };
}
