import type { AuthContext } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import {
  CHAT_CONTACTS_MAX,
  CHAT_CONTACTS_MIN_QUERY,
  canMemberMessage,
  chatDisplayName,
} from "@/lib/services/chat/chat-helpers";
import type { MyChatContactDto } from "@/lib/services/chat/types";

/**
 * Recherche contacts pour nouvelle conversation (lazy, max 20).
 * Miroir Web getUsersForConversation + filtre q serveur.
 * N'expose pas email / téléphone.
 */
export async function searchMyChatContacts(
  actor: AuthContext,
  query: string
): Promise<{ items: MyChatContactDto[] }> {
  if (!actor.userId) {
    throw new ServiceError("UNAUTHENTICATED", "Non authentifié");
  }

  const q = query.trim();
  if (q.length < CHAT_CONTACTS_MIN_QUERY) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      `Saisissez au moins ${CHAT_CONTACTS_MIN_QUERY} caractères`
    );
  }

  const users = await db.user.findMany({
    where: {
      status: "Actif",
      id: { not: actor.userId },
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        {
          adherent: {
            OR: [
              { firstname: { contains: q, mode: "insensitive" } },
              { lastname: { contains: q, mode: "insensitive" } },
            ],
          },
        },
      ],
    },
    select: {
      id: true,
      name: true,
      status: true,
      image: true,
      adherent: { select: { firstname: true, lastname: true } },
    },
    orderBy: [{ name: "asc" }],
    take: CHAT_CONTACTS_MAX,
  });

  const items = users
    .filter((u) =>
      canMemberMessage({
        actorUserId: actor.userId,
        targetUserId: u.id,
        targetStatus: u.status,
      })
    )
    .map((u) => ({
      id: u.id,
      displayName: chatDisplayName(u),
      image: u.image,
    }));

  return { items };
}
