/**
 * Bus léger pour rafraîchir Chat après push (foreground / retour app).
 * Pas de polling — listeners optionnels uniquement.
 */

type ChatPushListener = () => void;

const listeners = new Set<ChatPushListener>();

/**
 * Abonne un écran (liste Messages / Accueil badge) au refresh Chat.
 *
 * @returns fonction de désabonnement
 */
export function subscribeChatPushRefresh(listener: ChatPushListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Notifie les écrans abonnés qu'un push Chat (ou retour foreground) doit rafraîchir.
 */
export function notifyChatPushReceived(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // ignore listener errors
    }
  }
}

/**
 * Détecte un payload push lié au Chat (url Web /chat/:id).
 */
export function isChatPushData(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const url = (data as { url?: unknown }).url;
  return typeof url === "string" && url.includes("/chat/");
}

/** @internal tests */
export function resetChatPushListenersForTests(): void {
  listeners.clear();
}

/** @internal tests */
export function chatPushListenerCountForTests(): number {
  return listeners.size;
}
