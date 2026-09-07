import type { AuthContext } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import { chatNotificationLien } from "@/lib/services/chat/chat-helpers";
import { assertActiveParticipant } from "@/lib/services/chat/get-my-conversation";

/**
 * Marque les notifications Chat de la conversation comme lues.
 * Source de vérité non-lus = Notification type Chat (Web).
 */
export async function markMyConversationRead(
  actor: AuthContext,
  conversationId: string
): Promise<{ marked: number }> {
  if (!actor.userId) {
    throw new ServiceError("UNAUTHENTICATED", "Non authentifié");
  }
  if (!conversationId?.trim()) {
    throw new ServiceError("VALIDATION_ERROR", "ID de conversation requis");
  }

  await assertActiveParticipant(conversationId, actor.userId);

  const result = await db.notification.updateMany({
    where: {
      userId: actor.userId,
      type: "Chat",
      lue: false,
      lien: chatNotificationLien(conversationId),
    },
    data: { lue: true },
  });

  return { marked: result.count };
}
