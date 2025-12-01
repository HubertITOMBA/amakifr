"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode, useEffect } from "react";

interface AuthSessionProviderProps {
  children: ReactNode;
}

export function AuthSessionProvider({ children }: AuthSessionProviderProps) {
  // Intercepter les erreurs "No tab with id: -1" qui peuvent survenir avec NextAuth
  useEffect(() => {
    const originalError = console.error;
    console.error = (...args: any[]) => {
      // Filtrer l'erreur "No tab with id: -1" qui est souvent liée à NextAuth
      // mais qui n'est pas critique pour le fonctionnement de l'application
      if (args[0]?.toString().includes('No tab with id: -1')) {
        // Ignorer silencieusement cette erreur spécifique
        return;
      }
      originalError.apply(console, args);
    };

    // Intercepter les erreurs non capturées
    const handleError = (event: ErrorEvent) => {
      if (event.message?.includes('No tab with id: -1')) {
        event.preventDefault();
        return;
      }
    };

    window.addEventListener('error', handleError);

    // Intercepter les promesses rejetées
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason?.message?.includes('No tab with id: -1') || 
          event.reason?.toString().includes('No tab with id: -1')) {
        event.preventDefault();
        return;
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      console.error = originalError;
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return (
    <SessionProvider 
      refetchInterval={5 * 60} // Rafraîchir la session toutes les 5 minutes
      refetchOnWindowFocus={false} // Désactiver le rafraîchissement automatique pour éviter les erreurs
      basePath="/api/auth" // Spécifier explicitement le chemin de base
    >
      {children}
    </SessionProvider>
  );
}
