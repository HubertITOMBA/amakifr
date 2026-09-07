import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api/auth-resolve", () => ({
  resolveApiActor: vi.fn(),
}));

vi.mock("@/lib/services/chat/get-my-conversations", () => ({
  getMyConversations: vi.fn(),
  getMyChatUnreadCount: vi.fn(),
}));

vi.mock("@/lib/services/chat/get-my-conversation", () => ({
  getMyConversation: vi.fn(),
}));

vi.mock("@/lib/services/chat/send-my-message", () => ({
  sendMyMessage: vi.fn(),
}));

vi.mock("@/lib/services/chat/create-my-conversation", () => ({
  createMyConversation: vi.fn(),
}));

vi.mock("@/lib/services/chat/mark-my-conversation-read", () => ({
  markMyConversationRead: vi.fn(),
}));

vi.mock("@/lib/services/chat/search-my-chat-contacts", () => ({
  searchMyChatContacts: vi.fn(),
}));

import { resolveApiActor } from "@/lib/api/auth-resolve";
import {
  getMyChatUnreadCount,
  getMyConversations,
} from "@/lib/services/chat/get-my-conversations";
import { getMyConversation } from "@/lib/services/chat/get-my-conversation";
import { sendMyMessage } from "@/lib/services/chat/send-my-message";
import { createMyConversation } from "@/lib/services/chat/create-my-conversation";
import { markMyConversationRead } from "@/lib/services/chat/mark-my-conversation-read";
import { searchMyChatContacts } from "@/lib/services/chat/search-my-chat-contacts";
import { ServiceError } from "@/lib/service-error";
import { GET as GET_LIST, POST as POST_CREATE } from "./conversations/route";
import { GET as GET_ONE } from "./conversations/[id]/route";
import { POST as POST_MSG } from "./conversations/[id]/messages/route";
import { POST as POST_READ } from "./conversations/[id]/read/route";
import { GET as GET_UNREAD } from "./unread-count/route";
import { GET as GET_CONTACTS } from "./contacts/route";

const resolve = resolveApiActor as unknown as ReturnType<typeof vi.fn>;
const listFn = getMyConversations as unknown as ReturnType<typeof vi.fn>;
const unreadFn = getMyChatUnreadCount as unknown as ReturnType<typeof vi.fn>;
const detailFn = getMyConversation as unknown as ReturnType<typeof vi.fn>;
const sendFn = sendMyMessage as unknown as ReturnType<typeof vi.fn>;
const createFn = createMyConversation as unknown as ReturnType<typeof vi.fn>;
const readFn = markMyConversationRead as unknown as ReturnType<typeof vi.fn>;
const contactsFn = searchMyChatContacts as unknown as ReturnType<typeof vi.fn>;

const actor = {
  userId: "u1",
  email: "a@b.com",
  role: "MEMBRE",
  status: "Actif",
  adminRoles: [],
  adherentId: null,
  name: "Ada",
  sessionId: null,
  channel: "mobile",
};

function req(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost"), init);
}

describe("API /api/v1/me/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("401 sans auth", async () => {
    resolve.mockResolvedValue(null);
    const res = await GET_LIST(req("http://localhost/api/v1/me/chat/conversations"));
    expect(res.status).toBe(401);
  });

  it("refuse userId query", async () => {
    resolve.mockResolvedValue(actor);
    const res = await GET_LIST(
      req("http://localhost/api/v1/me/chat/conversations?userId=u2")
    );
    expect(res.status).toBe(400);
  });

  it("liste OK", async () => {
    resolve.mockResolvedValue(actor);
    listFn.mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
    const res = await GET_LIST(
      req("http://localhost/api/v1/me/chat/conversations?limit=20")
    );
    expect(res.status).toBe(200);
    expect(listFn).toHaveBeenCalledWith(actor, { limit: 20, offset: undefined });
  });

  it("création refuse senderId body", async () => {
    resolve.mockResolvedValue(actor);
    const res = await POST_CREATE(
      req("http://localhost/api/v1/me/chat/conversations", {
        method: "POST",
        body: JSON.stringify({
          participantIds: ["u2"],
          senderId: "hack",
        }),
        headers: { "content-type": "application/json" },
      })
    );
    expect(res.status).toBe(400);
    expect(createFn).not.toHaveBeenCalled();
  });

  it("création accepte body double-encodé (défense)", async () => {
    resolve.mockResolvedValue(actor);
    createFn.mockResolvedValue({ id: "c1" });
    const inner = JSON.stringify({
      type: "Privee",
      participantIds: ["u2"],
    });
    const res = await POST_CREATE(
      req("http://localhost/api/v1/me/chat/conversations", {
        method: "POST",
        body: JSON.stringify(inner),
        headers: { "content-type": "application/json" },
      })
    );
    expect(res.status).toBe(200);
    expect(createFn).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        participantIds: ["u2"],
        type: "Privee",
      })
    );
  });

  it("detail IDOR → 403", async () => {
    resolve.mockResolvedValue(actor);
    detailFn.mockRejectedValue(
      new ServiceError("FORBIDDEN", "pas autorisé")
    );
    const res = await GET_ONE(
      req("http://localhost/api/v1/me/chat/conversations/c1"),
      { params: Promise.resolve({ id: "c1" }) }
    );
    expect(res.status).toBe(403);
  });

  it("send message OK", async () => {
    resolve.mockResolvedValue(actor);
    sendFn.mockResolvedValue({
      message: { id: "m1", content: "Hi", isMine: true },
    });
    const res = await POST_MSG(
      req("http://localhost/api/v1/me/chat/conversations/c1/messages", {
        method: "POST",
        body: JSON.stringify({ content: "Hi" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: "c1" }) }
    );
    expect(res.status).toBe(200);
    expect(sendFn).toHaveBeenCalledWith(actor, "c1", {
      content: "Hi",
      replyToId: undefined,
    });
  });

  it("mark read + unread + contacts", async () => {
    resolve.mockResolvedValue(actor);
    readFn.mockResolvedValue({ marked: 1 });
    unreadFn.mockResolvedValue({ count: 4 });
    contactsFn.mockResolvedValue({ items: [] });

    expect(
      (
        await POST_READ(req("http://localhost/x", { method: "POST" }), {
          params: Promise.resolve({ id: "c1" }),
        })
      ).status
    ).toBe(200);
    expect((await GET_UNREAD(req("http://localhost/x"))).status).toBe(200);
    expect(
      (await GET_CONTACTS(req("http://localhost/x?q=bo"))).status
    ).toBe(200);
  });
});
