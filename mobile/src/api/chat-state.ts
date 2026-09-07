import type { ApiClientError } from "@/api/types";

/**
 * Message d'erreur API chat.
 */
export function chatErrorMessage(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as ApiClientError).message === "string"
  ) {
    return (error as ApiClientError).message;
  }
  return "Une erreur est survenue";
}

/**
 * Afficher badge Messages sur Home.
 */
export function shouldShowHomeChatBadge(unreadCount: number): boolean {
  return unreadCount > 0;
}

/**
 * Format date message (FR lisible).
 */
export function formatChatMessageWhen(
  iso: string,
  now: Date = new Date()
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";

  const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round(
    (startOfDay(now) - startOfDay(d)) / (24 * 60 * 60 * 1000)
  );
  const time = d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (dayDiff === 0) return `Aujourd'hui à ${time}`;
  if (dayDiff === 1) return `Hier à ${time}`;
  const date = d.toLocaleDateString("fr-FR");
  return `${date} à ${time}`;
}

/**
 * Format court liste (heure ou date).
 */
export function formatChatListWhen(
  iso: string | null,
  now: Date = new Date()
): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round(
    (startOfDay(now) - startOfDay(d)) / (24 * 60 * 60 * 1000)
  );
  if (dayDiff === 0) {
    return d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (dayDiff === 1) return "Hier";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

/**
 * Payload création conversation privée depuis un contact recherche.
 * contact.id = User.id (jamais Adherent.id).
 */
export function buildPrivateConversationPayload(contactUserId: string): {
  type: "Privee";
  participantIds: string[];
} {
  return {
    type: "Privee",
    participantIds: [contactUserId],
  };
}

/**
 * Après création : naviguer vers Conversation.id (pas recipientId).
 */
export function conversationThreadHref(conversationId: string): string {
  return `/messages/${conversationId}`;
}
