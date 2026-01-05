import { useState, useEffect } from "react";
import { VisibilityState } from "@tanstack/react-table";

/**
 * Hook personnalisé pour gérer la visibilité des colonnes sur mobile
 * 
 * @param storageKey - Clé unique pour sauvegarder les préférences dans localStorage
 * @param mobileHiddenColumns - Tableau des IDs de colonnes à masquer sur mobile par défaut
 * @returns État de visibilité des colonnes et fonction de mise à jour
 */
export function useMobileColumnVisibility(
  storageKey: string,
  mobileHiddenColumns: string[] = []
) {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          // Si les préférences existent, les utiliser
          if (Object.keys(parsed).length > 0) {
            return parsed;
          }
        }
        // Par défaut sur mobile, masquer les colonnes non essentielles
        const isMobile = window.innerWidth < 768; // md breakpoint
        if (isMobile && mobileHiddenColumns.length > 0) {
          const visibility: VisibilityState = {};
          mobileHiddenColumns.forEach((colId) => {
            visibility[colId] = false;
          });
          return visibility;
        }
      } catch (error) {
        console.error("Erreur lors du chargement des préférences:", error);
      }
    }
    return {};
  });

  // Détecter les changements de taille d'écran pour ajuster la visibilité des colonnes
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      const saved = localStorage.getItem(storageKey);
      
      // Si on passe en mode mobile et qu'il n'y a pas de préférences sauvegardées
      if (isMobile && mobileHiddenColumns.length > 0) {
        if (!saved || Object.keys(JSON.parse(saved || "{}")).length === 0) {
          const visibility: VisibilityState = {};
          mobileHiddenColumns.forEach((colId) => {
            visibility[colId] = false;
          });
          setColumnVisibility(visibility);
        }
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [storageKey, mobileHiddenColumns]);

  return [columnVisibility, setColumnVisibility] as const;
}
