import type { AuthContext } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import {
  chatDisplayName,
  clampMessagesPagination,
  conversationDisplayTitle,
} from "@/lib/services/chat/chat-helpers";
import type {
  MyChatConversationDetailDto,
  MyChatMessageDto,
} from "@/lib/services/chat/types";

function requireUserId(actor: AuthContext): string {
  if (!actor.userId) {
    throw new ServiceError("UNAUTHENTICATED", "Non authentifié");
  }
  return actor.userId;
}

/**
 * Assert participant actif (anti-IDOR).
 */
export async function assertActiveParticipant(
  conversationId: string,
  userId: string
): Promise<void> {
  const participant = await db.conversationParticipant.findFirst({
    where: { conversationId, userId, leftAt: null },
    select: { id: true },
  });
  if (!participant) {
    throw new ServiceError(
      "FORBIDDEN",
      "Vous n'êtes pas autorisé à accéder à cette conversation"
    );
  }
}

function mapMessage(
  m: {
    id: string;
    content: string;
    type: string;
    createdAt: Date;
    userId: string;
    edited: boolean;
    deleted: boolean;
    User: {
      name: string | null;
      image: string | null;
      adherent: { firstname: string | null; lastname: string | null } | null;
    };
    ReplyTo: {
      id: string;
      content: string;
      User: {
        name: string | null;
        adherent: { firstname: string | null; lastname: string | null } | null;
      };
    } | null;
  },
  actorUserId: string
): MyChatMessageDto {
  return {
    id: m.id,
    content: m.content,
    type: m.type,
    createdAt: m.createdAt.toISOString(),
    isMine: m.userId === actorUserId,
    edited: m.edited,
    deleted: m.deleted,
    author: {
      displayName: chatDisplayName(m.User),
      image: m.User.image,
    },
    replyTo: m.ReplyTo
      ? {
          id: m.ReplyTo.id,
          content: m.ReplyTo.content,
          authorDisplayName: chatDisplayName(m.ReplyTo.User),
        }
      : null,
  };
}

/**
 * Détail conversation + messages paginés (page Web : desc puis reverse).
 */
export async function getMyConversation(
  actor: AuthContext,
  conversationId: string,
  options: { page?: number; limit?: number } = {}
): Promise<MyChatConversationDetailDto> {
  const userId = requireUserId(actor);
  if (!conversationId?.trim()) {
    throw new ServiceError("VALIDATION_ERROR", "ID de conversation requis");
  }

  await assertActiveParticipant(conversationId, userId);

  const { page, limit } = clampMessagesPagination(options);
  const skip = (page - 1) * limit;

  const where = { conversationId, deleted: false };

  const [messages, totalCount, conversation] = await Promise.all([
    db.message.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
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
    }),
    db.message.count({ where }),
    db.conversation.findUnique({
      where: { id: conversationId },
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
                adherent: { select: { firstname: true, lastname: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  if (!conversation) {
    throw new ServiceError("NOT_FOUND", "Conversation introuvable");
  }

  const ordered = [...messages].reverse();
  const participants = conversation.Participants.map((p) => ({
    userId: p.User.id,
    displayName: chatDisplayName(p.User),
    image: p.User.image,
    role: p.role,
  }));

  return {
    id: conversation.id,
    type: conversation.type,
    titre: conversation.titre,
    displayTitle: conversationDisplayTitle({
      type: conversation.type,
      titre: conversation.titre,
      evenementTitre: conversation.Evenement?.titre ?? null,
      actorUserId: userId,
      participants,
    }),
    evenementTitre: conversation.Evenement?.titre ?? null,
    participants,
    messages: ordered.map((m) => mapMessage(m, userId)),
    pagination: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / limit)),
      hasMore: skip + limit < totalCount,
    },
  };
}

export { mapMessage };
