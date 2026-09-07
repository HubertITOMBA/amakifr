import { authenticatedFetch } from "@/auth/session";
import type {
  MyChatContactDto,
  MyChatConversationDetailDto,
  MyChatConversationsListDto,
  MyChatMessageDto,
  MyChatUnreadCountDto,
} from "@/api/types";

/**
 * GET /api/v1/me/chat/unread-count
 */
export async function getMyChatUnreadCount(): Promise<MyChatUnreadCountDto> {
  return authenticatedFetch<MyChatUnreadCountDto>(
    "/api/v1/me/chat/unread-count"
  );
}

/**
 * GET /api/v1/me/chat/conversations
 */
export async function getMyConversations(params?: {
  limit?: number;
  offset?: number;
}): Promise<MyChatConversationsListDto> {
  const q = new URLSearchParams();
  if (params?.limit != null) q.set("limit", String(params.limit));
  if (params?.offset != null) q.set("offset", String(params.offset));
  const qs = q.toString();
  return authenticatedFetch<MyChatConversationsListDto>(
    `/api/v1/me/chat/conversations${qs ? `?${qs}` : ""}`
  );
}

/**
 * GET /api/v1/me/chat/conversations/[id]
 */
export async function getMyConversation(
  id: string,
  params?: { page?: number; limit?: number }
): Promise<MyChatConversationDetailDto> {
  const q = new URLSearchParams();
  if (params?.page != null) q.set("page", String(params.page));
  if (params?.limit != null) q.set("limit", String(params.limit));
  const qs = q.toString();
  return authenticatedFetch<MyChatConversationDetailDto>(
    `/api/v1/me/chat/conversations/${encodeURIComponent(id)}${qs ? `?${qs}` : ""}`
  );
}

/**
 * POST /api/v1/me/chat/conversations
 * Body objet (jamais JSON.stringify côté client — fetchApiResponse le fait).
 */
export async function createMyConversation(input: {
  type?: "Privee" | "Groupe";
  titre?: string;
  participantIds: string[];
}): Promise<{ id: string }> {
  return authenticatedFetch<{ id: string }>("/api/v1/me/chat/conversations", {
    method: "POST",
    body: input,
  });
}

/**
 * POST .../messages
 */
export async function sendMyMessage(
  conversationId: string,
  content: string
): Promise<{ message: MyChatMessageDto }> {
  return authenticatedFetch<{ message: MyChatMessageDto }>(
    `/api/v1/me/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: "POST",
      body: { content },
    }
  );
}

/**
 * POST .../read
 */
export async function markMyConversationRead(
  conversationId: string
): Promise<{ marked: number }> {
  return authenticatedFetch<{ marked: number }>(
    `/api/v1/me/chat/conversations/${encodeURIComponent(conversationId)}/read`,
    { method: "POST", body: {} }
  );
}

/**
 * GET /api/v1/me/chat/contacts?q=
 */
export async function searchMyChatContacts(
  q: string
): Promise<{ items: MyChatContactDto[] }> {
  return authenticatedFetch<{ items: MyChatContactDto[] }>(
    `/api/v1/me/chat/contacts?q=${encodeURIComponent(q)}`
  );
}
