"use client";

import { useBuildId } from "@/hooks/use-build-id";
import { useEffect } from "react";

/**
 * Composant qui vérifie périodiquement le build ID et force un refresh
 * si un nouveau build est détecté
 * 
 * Ce composant doit être ajouté dans le layout principal pour fonctionner
 * sur toutes les pages
 */
export function BuildIdChecker() {
  const { buildInfo, isChecking } = useBuildId(30000); // Vérification toutes les 30 secondes

  useEffect(() => {
    // Log pour le debugging (seulement en développement)
    if (process.env.NODE_ENV === 'development' && buildInfo) {
      console.log('📦 Build ID actuel:', buildInfo.buildId);
    }
  }, [buildInfo]);

  // Ce composant ne rend rien visuellement
  // Il fonctionne en arrière-plan pour détecter les nouveaux builds
  return null;
}
