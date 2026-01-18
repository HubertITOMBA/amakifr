"use client";

import { useEffect } from "react";
import { handleChunkLoadError, isChunkLoadError, isBadGatewayError } from "@/lib/chunk-error-handler";

/**
 * Composant pour gérer globalement les erreurs de chargement de chunks Next.js
 * À placer dans le layout principal
 */
export function ChunkErrorHandler() {
  useEffect(() => {
    // Gérer les erreurs non capturées de chunks
    const handleError = (event: ErrorEvent) => {
      const error = event.error;
      
      if (isChunkLoadError(error) || isBadGatewayError(error)) {
        event.preventDefault(); // Empêcher l'affichage de l'erreur dans la console
        console.warn("⚠️ Erreur de chargement de chunk détectée, rechargement de la page...");
        
        handleChunkLoadError(error, 0);
      }
    };

    // Gérer les erreurs de promesses non capturées (comme les imports dynamiques)
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason;
      
      if (isChunkLoadError(error) || isBadGatewayError(error)) {
        event.preventDefault(); // Empêcher l'affichage de l'erreur dans la console
        console.warn("⚠️ Erreur de chargement de chunk détectée (promesse rejetée), rechargement de la page...");
        
        handleChunkLoadError(error, 0);
      }
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null; // Ce composant ne rend rien
}
