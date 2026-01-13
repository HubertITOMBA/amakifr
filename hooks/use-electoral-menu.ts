"use client";

import { useState, useEffect } from "react";
import { getElectoralMenuStatus } from "@/actions/settings/electoral-menu";

const STORAGE_KEY = "electoral-menu-enabled";

/**
 * Hook pour récupérer l'état d'activation des menus électoraux
 * Utilise localStorage pour éviter le flash lors du chargement initial
 * 
 * @returns enabled (boolean) - true si les menus doivent être affichés
 */
export function useElectoralMenu() {
  // Charger depuis localStorage pour éviter le flash
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      return cached ? cached === "true" : true;
    } catch {
      return true;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const result = await getElectoralMenuStatus();
        if (result.success) {
          setEnabled(result.enabled);
          // Mettre en cache pour les prochains chargements
          try {
            localStorage.setItem(STORAGE_KEY, result.enabled.toString());
          } catch (error) {
            console.error("Erreur lors de la sauvegarde dans localStorage:", error);
          }
        }
      } catch (error) {
        console.error("Erreur lors de la récupération du statut des menus électoraux:", error);
        // En cas d'erreur, on garde la valeur du cache ou true par défaut
      } finally {
        setLoading(false);
      }
    }

    fetchStatus();
  }, []);

  return { enabled, loading };
}
