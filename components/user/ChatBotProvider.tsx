"use client";

import { useSession } from "next-auth/react";
import { ChatBot } from "./ChatBot";

/**
 * Provider pour le ChatBot
 * Affiche le chatbot uniquement pour les utilisateurs connectés (non-admin)
 */
export function ChatBotProvider() {
  const { data: session, status } = useSession();
  
  // Afficher le chatbot uniquement pour les utilisateurs connectés (Membre ou Invite)
  // Ne pas l'afficher pour les admins (ils ont déjà accès à toutes les fonctionnalités)
  if (status === "loading" || !session?.user) {
    return null;
  }
  
  if (session.user.role === "Admin") {
    return null;
  }
  
  return <ChatBot />;
}
