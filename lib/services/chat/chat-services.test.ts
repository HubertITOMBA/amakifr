import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth-context";

const {
  findManyParticipant,
  countParticipant,
  findFirstParticipant,
  findManyMessage,
  countMessage,
  findUniqueConversation,
  createMessage,
  updateConversation,
  createManyNotification,
  findManyUser,
  createConversation,
  updateManyNotification,
  countNotification,
  groupByNotification,
  findManyOtherParticipants,
} = vi.hoisted(() => ({
  findManyParticipant: vi.fn(),
  countParticipant: vi.fn(),
  findFirstParticipant: vi.fn(),
  findManyMessage: vi.fn(),
  countMessage: vi.fn(),
  findUniqueConversation: vi.fn(),
  createMessage: vi.fn(),
  updateConversation: vi.fn(),
  createManyNotification: vi.fn(),
  findManyUser: vi.fn(),
  createConversation: vi.fn(),
  updateManyNotification: vi.fn(),
  countNotification: vi.fn(),
  groupByNotification: vi.fn(),
  findManyOtherParticipants: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    conversationParticipant: {
      findMany: (...args: unknown[]) => {
        // distinguish list vs others by args
        const a = args[0] as { where?: { userId?: { not?: string } } };
        if (a?.where?.userId && typeof a.where.userId === "object") {
          return findManyOtherParticipants(...args);
        }
        return findManyParticipant(...args);
      },
      count: countParticipant,
      findFirst: findFirstParticipant,
    },
    message: {
      findMany: findManyMessage,
      count: countMessage,
      create: createMessage,
      findFirst: vi.fn(),
    },
    conversation: {
      findUnique: findUniqueConversation,
      update: updateConversation,
      create: createConversation,
    },
    notification: {
      createMany: createManyNotification,
      updateMany: updateManyNotification,
      count: countNotification,
      groupBy: groupByNotification,
    },
    user: { findMany: findManyUser },
  },
}));

vi.mock("@/lib/services/push/send-push", () => ({
  sendPushToUsers: vi.fn().mockResolvedValue({
    attempted: 0,
    ok: 0,
    errors: 0,
    disabled: 0,
  }),
  sendPushToUser: vi.fn().mockResolvedValue({
    attempted: 0,
    ok: 0,
    errors: 0,
    disabled: 0,
  }),
}));

import { getMyConversations, getMyChatUnreadCount } from "@/lib/services/chat/get-my-conversations";
import { getMyConversation } from "@/lib/services/chat/get-my-conversation";
import { sendMyMessage } from "@/lib/services/chat/send-my-message";
import { createMyConversation } from "@/lib/services/chat/create-my-conversation";
import { markMyConversationRead } from "@/lib/services/chat/mark-my-conversation-read";
import { searchMyChatContacts } from "@/lib/services/chat/search-my-chat-contacts";
import { sendPushToUsers } from "@/lib/services/push/send-push";

const actor = (): AuthContext =>
  ({
    userId: "u1",
    email: "a@b.com",
    role: "MEMBRE",
    status: "Actif",
    adminRoles: [],
    adherentId: null,
    name: "Ada",
    sessionId: null,
    channel: "mobile",
  }) as AuthContext;

describe("chat services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("unread count Chat", async () => {
    countNotification.mockResolvedValue(3);
    await expect(getMyChatUnreadCount(actor())).resolves.toEqual({ count: 3 });
  });

  it("liste conversations self + unread par lien", async () => {
    countParticipant.mockResolvedValue(1);
    findManyParticipant.mockResolvedValue([
      {
        Conversation: {
          id: "c1",
          type: "Privee",
          titre: null,
          updatedAt: new Date("2026-06-01"),
          Evenement: null,
          Participants: [
            {
              role: "ADMIN",
              User: {
                id: "u1",
                name: "Ada",
                image: null,
                adherent: null,
              },
            },
            {
              role: "Participant",
              User: {
                id: "u2",
                name: "Bob",
                image: null,
                adherent: { firstname: "Bob", lastname: "Martin" },
              },
            },
          ],
          Messages: [
            {
              id: "m1",
              content: "Salut",
              createdAt: new Date("2026-06-01"),
            },
          ],
        },
      },
    ]);
    groupByNotification.mockResolvedValue([
      { lien: "/chat/c1", _count: { _all: 2 } },
    ]);
    const r = await getMyConversations(actor(), { limit: 20, offset: 0 });
    expect(r.items).toHaveLength(1);
    expect(r.items[0].displayTitle).toBe("Bob Martin");
    expect(r.items[0].unreadCount).toBe(2);
  });

  it("IDOR getMyConversation sans participation", async () => {
    findFirstParticipant.mockResolvedValue(null);
    await expect(getMyConversation(actor(), "c-x")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("getMyConversation OK + messages anciens→récents", async () => {
    findFirstParticipant.mockResolvedValue({ id: "p1" });
    findManyMessage.mockResolvedValue([
      {
        id: "m2",
        content: "B",
        type: "Texte",
        createdAt: new Date("2026-06-02"),
        userId: "u2",
        edited: false,
        deleted: false,
        User: { name: "Bob", image: null, adherent: null },
        ReplyTo: null,
      },
      {
        id: "m1",
        content: "A",
        type: "Texte",
        createdAt: new Date("2026-06-01"),
        userId: "u1",
        edited: false,
        deleted: false,
        User: { name: "Ada", image: null, adherent: null },
        ReplyTo: null,
      },
    ]);
    countMessage.mockResolvedValue(2);
    findUniqueConversation.mockResolvedValue({
      id: "c1",
      type: "Privee",
      titre: null,
      Evenement: null,
      Participants: [
        {
          role: "ADMIN",
          User: { id: "u1", name: "Ada", image: null, adherent: null },
        },
      ],
    });
    const r = await getMyConversation(actor(), "c1", { page: 1, limit: 50 });
    expect(r.messages[0].id).toBe("m1");
    expect(r.messages[1].id).toBe("m2");
    expect(r.messages[0].isMine).toBe(true);
  });

  it("sendMyMessage refuse vide / trop long + crée notif", async () => {
    await expect(
      sendMyMessage(actor(), "c1", { content: "  " })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    findFirstParticipant.mockResolvedValue({ id: "p1" });
    createMessage.mockResolvedValue({
      id: "m1",
      content: "Hi",
      type: "Texte",
      createdAt: new Date(),
      userId: "u1",
      edited: false,
      deleted: false,
      User: { name: "Ada", image: null, adherent: null },
      ReplyTo: null,
    });
    updateConversation.mockResolvedValue({});
    findManyOtherParticipants.mockResolvedValue([{ userId: "u2" }]);
    findUniqueConversation.mockResolvedValue({ titre: null });
    createManyNotification.mockResolvedValue({ count: 1 });

    const r = await sendMyMessage(actor(), "c1", { content: "Hi" });
    expect(r.message.content).toBe("Hi");
    expect(createManyNotification).toHaveBeenCalled();
    // laisser microtask push
    await Promise.resolve();
    expect(sendPushToUsers).toHaveBeenCalledWith(
      ["u2"],
      expect.objectContaining({
        title: expect.stringContaining("Nouveau message"),
        body: "Vous avez reçu un nouveau message.",
        data: { url: "/chat/c1" },
      })
    );
    // pas de push au sender
    const pushedUsers = (sendPushToUsers as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string[];
    expect(pushedUsers).not.toContain("u1");
  });

  it("createMyConversation refuse destinataire inactif", async () => {
    findManyUser.mockResolvedValue([{ id: "u2", status: "Inactif" }]);
    await expect(
      createMyConversation(actor(), {
        type: "Privee",
        participantIds: ["u2"],
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("createMyConversation id inexistant → NOT_FOUND", async () => {
    findManyUser.mockResolvedValue([]);
    await expect(
      createMyConversation(actor(), {
        type: "Privee",
        participantIds: ["missing"],
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("createMyConversation self seul → VALIDATION", async () => {
    await expect(
      createMyConversation(actor(), {
        type: "Privee",
        participantIds: ["u1"],
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("createMyConversation Privee OK — participants User.id", async () => {
    findManyUser.mockResolvedValue([{ id: "u2", status: "Actif" }]);
    createConversation.mockResolvedValue({ id: "c-new" });
    await expect(
      createMyConversation(actor(), {
        type: "Privee",
        participantIds: ["u2"],
      })
    ).resolves.toEqual({ id: "c-new" });
    expect(createConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "Privee",
          createdBy: "u1",
          Participants: {
            create: [
              { userId: "u1", role: "ADMIN" },
              { userId: "u2", role: "Participant" },
            ],
          },
        }),
      })
    );
  });

  it("search contacts retourne User.id (pas Adherent.id)", async () => {
    findManyUser.mockResolvedValue([
      {
        id: "user-bob",
        name: "Bob",
        status: "Actif",
        image: null,
        adherent: { firstname: "Bob", lastname: "Martin" },
      },
    ]);
    const r = await searchMyChatContacts(actor(), "bo");
    expect(r.items[0].id).toBe("user-bob");
    expect(r.items[0].id).not.toBe("adherent-id");
    expect(r.items[0]).not.toHaveProperty("email");
  });

  it("mark read exige participation", async () => {
    findFirstParticipant.mockResolvedValue(null);
    await expect(markMyConversationRead(actor(), "c1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    findFirstParticipant.mockResolvedValue({ id: "p1" });
    updateManyNotification.mockResolvedValue({ count: 2 });
    await expect(markMyConversationRead(actor(), "c1")).resolves.toEqual({
      marked: 2,
    });
  });

  it("search contacts min 2 chars, sans email", async () => {
    await expect(searchMyChatContacts(actor(), "a")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    findManyUser.mockResolvedValue([
      {
        id: "u2",
        name: "Bob",
        status: "Actif",
        image: null,
        adherent: null,
      },
    ]);
    const r = await searchMyChatContacts(actor(), "bo");
    expect(r.items[0]).toEqual({
      id: "u2",
      displayName: "Bob",
      image: null,
    });
    expect(r.items[0]).not.toHaveProperty("email");
  });
});
