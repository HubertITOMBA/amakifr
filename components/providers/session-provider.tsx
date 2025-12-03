"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode, useEffect } from "react";

interface AuthSessionProviderProps {
  children: ReactNode;
}

export function AuthSessionProvider({ children }: AuthSessionProviderProps) {
  // Intercepter les erreurs "No tab with id: -1" et "flushSync" qui peuvent survenir avec NextAuth
  useEffect(() => {
    const originalError = console.error;
    console.error = (...args: any[]) => {
      const errorMessage = args[0]?.toString() || '';
      
      // Filtrer l'erreur "No tab with id: -1" qui est souvent liée à NextAuth
      if (errorMessage.includes('No tab with id: -1')) {
        return;
      }
      
      // Filtrer l'erreur "flushSync" qui peut survenir avec les modals et NextAuth
      // Cette erreur n'est pas critique et peut être ignorée en production
      if (errorMessage.includes('flushSync') || 
          errorMessage.includes('React cannot flush when React is already rendering')) {
        return;
      }
      
      originalError.apply(console, args);
    };

    // Intercepter les erreurs non capturées
    const handleError = (event: ErrorEvent) => {
      const message = event.message || '';
      if (message.includes('No tab with id: -1') || 
          message.includes('flushSync') ||
          message.includes('React cannot flush when React is already rendering')) {
        event.preventDefault();
        return;
      }
    };

    window.addEventListener('error', handleError);

    // Intercepter les promesses rejetées
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason?.message || event.reason?.toString() || '';
      if (reason.includes('No tab with id: -1') || 
          reason.includes('flushSync') ||
          reason.includes('React cannot flush when React is already rendering')) {
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
