/**
 * Helpers messagerie — règles Web `actions/chat`.
 */

import { normalizeString } from "@/lib/utils";

export const CHAT_MESSAGE_MAX_LENGTH = 10_000;
export const CHAT_CONTACTS_MIN_QUERY = 2;
export const CHAT_CONTACTS_MAX = 20;
export const CHAT_CONVERSATIONS_DEFAULT_LIMIT = 20;
export const CHAT_CONVERSATIONS_MAX_LIMIT = 50;
export const CHAT_MESSAGES_DEFAULT_LIMIT = 50;
export const CHAT_MESSAGES_MAX_LIMIT = 50;

/**
 * Qui peut être contacté (miroir Web `getUsersForConversation`) :
 * utilisateur Actif, distinct de self.
 * Pas de filtre adhérent / cotisation côté Web.
 */
export function canMemberMessage(params: {
  actorUserId: string;
  targetUserId: string;
  targetStatus: string;
}): boolean {
  if (!params.targetUserId || params.targetUserId === params.actorUserId) {
    return false;
  }
  return params.targetStatus === "Actif";
}

/**
 * Nom affichable sans email.
 */
export function chatDisplayName(user: {
  name?: string | null;
  adherent?: { firstname?: string | null; lastname?: string | null } | null;
}): string {
  const fromAdherent = [user.adherent?.firstname, user.adherent?.lastname]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (fromAdherent) return fromAdherent;
  const n = user.name?.trim();
  if (n) return n;
  return "Membre";
}

/**
 * Recherche contacts Chat : match sur prénom + nom uniquement
 * (insensible casse / accents). Pas d'email, téléphone, ni User.name.
 */
export function chatContactIdentityMatches(
  identity: {
    firstname?: string | null;
    lastname?: string | null;
  },
  query: string
): boolean {
  const foldedQ = normalizeString(query.trim());
  if (!foldedQ) return false;
  const first = identity.firstname?.trim() ?? "";
  const last = identity.lastname?.trim() ?? "";
  if (!first && !last) return false;
  const haystack = normalizeString(`${first} ${last}`.trim());
  return haystack.includes(foldedQ);
}

/**
 * Titre conversation pour liste / détail.
 */
export function conversationDisplayTitle(params: {
  type: string;
  titre: string | null;
  evenementTitre?: string | null;
  actorUserId: string;
  participants: Array<{
    userId: string;
    displayName: string;
  }>;
}): string {
  if (params.titre?.trim()) return params.titre.trim();
  if (params.type === "Evenement" && params.evenementTitre) {
    return params.evenementTitre;
  }
  const others = params.participants.filter(
    (p) => p.userId !== params.actorUserId
  );
  if (others.length === 1) return others[0].displayName;
  if (others.length > 1) {
    return others
      .slice(0, 3)
      .map((p) => p.displayName)
      .join(", ");
  }
  return "Conversation";
}

/**
 * Preview dernier message (tronqué).
 */
export function messagePreview(content: string, max = 80): string {
  const t = content.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

/**
 * Lien notification Chat (source de vérité non-lus Web).
 */
export function chatNotificationLien(conversationId: string): string {
  return `/chat/${conversationId}`;
}

/**
 * Clamp pagination conversations.
 */
export function clampConversationsPagination(input: {
  limit?: number;
  offset?: number;
}): { limit: number; offset: number } {
  const limit = Math.min(
    CHAT_CONVERSATIONS_MAX_LIMIT,
    Math.max(1, Math.floor(input.limit ?? CHAT_CONVERSATIONS_DEFAULT_LIMIT))
  );
  const offset = Math.max(0, Math.floor(input.offset ?? 0));
  return { limit, offset };
}

/**
 * Clamp pagination messages (page Web).
 */
export function clampMessagesPagination(input: {
  page?: number;
  limit?: number;
}): { page: number; limit: number } {
  const limit = Math.min(
    CHAT_MESSAGES_MAX_LIMIT,
    Math.max(1, Math.floor(input.limit ?? CHAT_MESSAGES_DEFAULT_LIMIT))
  );
  const page = Math.max(1, Math.floor(input.page ?? 1));
  return { page, limit };
}
