"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

interface AuthSessionProviderProps {
  children: ReactNode;
}

export function AuthSessionProvider({ children }: AuthSessionProviderProps) {
  return (
    <SessionProvider 
      refetchInterval={5 * 60} // Rafraîchir la session toutes les 5 minutes
      refetchOnWindowFocus={true} // Rafraîchir quand la fenêtre reprend le focus
    >
      {children}
    </SessionProvider>
  );
}
