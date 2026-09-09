import type { AuthContext } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import {
  CHAT_CONTACTS_MAX,
  CHAT_CONTACTS_MIN_QUERY,
  canMemberMessage,
  chatContactIdentityMatches,
  chatDisplayName,
} from "@/lib/services/chat/chat-helpers";
import type { MyChatContactDto } from "@/lib/services/chat/types";

/**
 * Recherche contacts pour nouvelle conversation (lazy, max 20).
 * Match uniquement prénom + nom adhérent (casse / accents).
 * N'utilise pas User.name, email ni téléphone (non affichés).
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

  // Candidats Actifs (hors self) — filtre identité en mémoire pour accents.
  // Association : volume limité ; pas de User.name (faux positifs type Sidonie).
  const users = await db.user.findMany({
    where: {
      status: "Actif",
      id: { not: actor.userId },
      adherent: { isNot: null },
    },
    select: {
      id: true,
      name: true,
      status: true,
      image: true,
      adherent: { select: { firstname: true, lastname: true } },
    },
    orderBy: [{ name: "asc" }],
  });

  const items: MyChatContactDto[] = [];
  for (const u of users) {
    if (
      !canMemberMessage({
        actorUserId: actor.userId,
        targetUserId: u.id,
        targetStatus: u.status,
      })
    ) {
      continue;
    }
    if (
      !chatContactIdentityMatches(
        {
          firstname: u.adherent?.firstname,
          lastname: u.adherent?.lastname,
        },
        q
      )
    ) {
      continue;
    }
    items.push({
      id: u.id,
      displayName: chatDisplayName(u),
      image: u.image,
    });
    if (items.length >= CHAT_CONTACTS_MAX) break;
  }

  return { items };
}
