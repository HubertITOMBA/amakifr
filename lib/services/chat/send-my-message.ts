import { z } from "zod";
import type { AuthContext } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import {
  CHAT_MESSAGE_MAX_LENGTH,
  chatDisplayName,
  chatNotificationLien,
} from "@/lib/services/chat/chat-helpers";
import { assertActiveParticipant, mapMessage } from "@/lib/services/chat/get-my-conversation";
import type { SendMyMessageResultDto } from "@/lib/services/chat/types";

const SendSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Le contenu du message est requis")
    .max(CHAT_MESSAGE_MAX_LENGTH, "Message trop long"),
  replyToId: z.string().min(1).optional(),
});

/**
 * Envoie un message texte (self = sender). Miroir Web sendMessage + notifs Chat.
 * Types Image/Fichier non exposés en V1 mobile (UI Web texte uniquement).
 */
export async function sendMyMessage(
  actor: AuthContext,
  conversationId: string,
  payload: { content: string; replyToId?: string }
): Promise<SendMyMessageResultDto> {
  if (!actor.userId) {
    throw new ServiceError("UNAUTHENTICATED", "Non authentifié");
  }
  if (!conversationId?.trim()) {
    throw new ServiceError("VALIDATION_ERROR", "ID de conversation requis");
  }

  const parsed = SendSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      parsed.error.errors[0]?.message || "Message invalide"
    );
  }

  await assertActiveParticipant(conversationId, actor.userId);

  if (parsed.data.replyToId) {
    const reply = await db.message.findFirst({
      where: {
        id: parsed.data.replyToId,
        conversationId,
        deleted: false,
      },
      select: { id: true },
    });
    if (!reply) {
      throw new ServiceError("VALIDATION_ERROR", "Message de réponse invalide");
    }
  }

  const created = await db.message.create({
    data: {
      conversationId,
      userId: actor.userId,
      content: parsed.data.content,
      type: "Texte",
      replyToId: parsed.data.replyToId,
    },
    include: {
      User: {
        select: {
          name: true,
          image: true,
          adherent: { select: { firstname: true, lastname: true } },
        },
      },
      ReplyTo: {
        include: {
          User: {
            select: {
              name: true,
              adherent: { select: { firstname: true, lastname: true } },
            },
          },
        },
      },
    },
  });

  await db.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  const others = await db.conversationParticipant.findMany({
    where: {
      conversationId,
      leftAt: null,
      userId: { not: actor.userId },
    },
    select: { userId: true },
  });

  if (others.length > 0) {
    const senderName =
      actor.name?.trim() ||
      chatDisplayName({ name: actor.name }) ||
      "Un utilisateur";
    const preview =
      parsed.data.content.length > 50
        ? `${parsed.data.content.slice(0, 50)}...`
        : parsed.data.content;
    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
      select: { titre: true },
    });
    const conversationTitle = conversation?.titre || "Conversation";

    await db.notification.createMany({
      data: others.map((p) => ({
        userId: p.userId,
        type: "Chat" as const,
        titre: `Nouveau message de ${senderName}`,
        message: `${conversationTitle}: ${preview}`,
        lien: chatNotificationLien(conversationId),
        lue: false,
      })),
    });

    // Push après commit DB — best-effort, jamais de rollback métier
    const { sendPushToUsers } = await import("@/lib/services/push/send-push");
    void sendPushToUsers(
      others.map((p) => p.userId),
      {
        title: `Nouveau message de ${senderName}`,
        body: "Vous avez reçu un nouveau message.",
        data: { url: chatNotificationLien(conversationId) },
      }
    ).catch((error) => {
      console.error("[chat] push after message failed:", error);
    });
  }

  return { message: mapMessage(created, actor.userId) };
}
