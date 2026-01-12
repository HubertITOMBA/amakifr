"use client";

import { useSession } from "next-auth/react";
import { ChatBot } from "./ChatBot";

/**
 * Provider pour le ChatBot
 * Affiche le chatbot pour tous les utilisateurs connectés (membres, bureau et admins)
 */
export function ChatBotProvider() {
  const { data: session, status } = useSession();
  
  // Afficher le chatbot uniquement pour les utilisateurs connectés
  // (Admins, Bureau, Membre et Invite)
  if (status === "loading" || !session?.user) {
    return null;
  }
  
  return <ChatBot />;
}
