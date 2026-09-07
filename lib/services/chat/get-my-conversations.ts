import type { AuthContext } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import {
  chatDisplayName,
  chatNotificationLien,
  clampConversationsPagination,
  conversationDisplayTitle,
  messagePreview,
} from "@/lib/services/chat/chat-helpers";
import type {
  MyChatConversationsListDto,
  MyChatUnreadCountDto,
} from "@/lib/services/chat/types";

function requireUserId(actor: AuthContext): string {
  if (!actor.userId) {
    throw new ServiceError("UNAUTHENTICATED", "Non authentifié");
  }
  return actor.userId;
}

/**
 * Nombre de notifications Chat non lues (source de vérité Web).
 */
export async function getMyChatUnreadCount(
  actor: AuthContext
): Promise<MyChatUnreadCountDto> {
  const userId = requireUserId(actor);
  const count = await db.notification.count({
    where: { userId, type: "Chat", lue: false },
  });
  return { count };
}

/**
 * Liste paginée des conversations self (participant, leftAt null).
 * Tri : Conversation.updatedAt desc.
 */
export async function getMyConversations(
  actor: AuthContext,
  options: { limit?: number; offset?: number } = {}
): Promise<MyChatConversationsListDto> {
  const userId = requireUserId(actor);
  const { limit, offset } = clampConversationsPagination(options);

  const where = { userId, leftAt: null as Date | null };

  const [total, rows] = await Promise.all([
    db.conversationParticipant.count({ where }),
    db.conversationParticipant.findMany({
      where,
      orderBy: { Conversation: { updatedAt: "desc" } },
      skip: offset,
      take: limit,
      include: {
        Conversation: {
          include: {
            Evenement: { select: { titre: true } },
            Participants: {
              where: { leftAt: null },
              include: {
                User: {
                  select: {
                    id: true,
                    name: true,
                    image: true,
                    adherent: {
                      select: { firstname: true, lastname: true },
                    },
                  },
                },
              },
            },
            Messages: {
              where: { deleted: false },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                id: true,
                content: true,
                createdAt: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const conversationIds = rows.map((r) => r.Conversation.id);
  const unreadByConversation = new Map<string, number>();
  if (conversationIds.length > 0) {
    const notifs = await db.notification.groupBy({
      by: ["lien"],
      where: {
        userId,
        type: "Chat",
        lue: false,
        lien: { in: conversationIds.map(chatNotificationLien) },
      },
      _count: { _all: true },
    });
    for (const n of notifs) {
      if (!n.lien) continue;
      const id = n.lien.replace(/^\/chat\//, "");
      unreadByConversation.set(id, n._count._all);
    }
  }

  const items = rows.map((pc) => {
    const c = pc.Conversation;
    const participants = c.Participants.map((p) => ({
      userId: p.User.id,
      displayName: chatDisplayName(p.User),
      image: p.User.image,
    }));
    const last = c.Messages[0] ?? null;
    const others = participants.filter((p) => p.userId !== userId);
    const image =
      c.type === "Privee" && others[0]?.image
        ? others[0].image
        : others.find((p) => p.image)?.image ?? null;

    return {
      id: c.id,
      type: c.type,
      titre: c.titre,
      displayTitle: conversationDisplayTitle({
        type: c.type,
        titre: c.titre,
        evenementTitre: c.Evenement?.titre ?? null,
        actorUserId: userId,
        participants,
      }),
      image,
      lastMessagePreview: last ? messagePreview(last.content) : null,
      lastMessageAt: last ? last.createdAt.toISOString() : c.updatedAt.toISOString(),
      unreadCount: unreadByConversation.get(c.id) ?? 0,
      participantCount: participants.length,
    };
  });

  return { items, total, limit, offset };
}
