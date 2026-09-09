import { describe, expect, it } from "vitest";
import {
  canMemberMessage,
  chatContactIdentityMatches,
  chatDisplayName,
  chatNotificationLien,
  clampConversationsPagination,
  clampMessagesPagination,
  conversationDisplayTitle,
  messagePreview,
} from "@/lib/services/chat/chat-helpers";

describe("chat-helpers", () => {
  it("canMemberMessage — Actif distinct de self", () => {
    expect(
      canMemberMessage({
        actorUserId: "u1",
        targetUserId: "u2",
        targetStatus: "Actif",
      })
    ).toBe(true);
    expect(
      canMemberMessage({
        actorUserId: "u1",
        targetUserId: "u1",
        targetStatus: "Actif",
      })
    ).toBe(false);
    expect(
      canMemberMessage({
        actorUserId: "u1",
        targetUserId: "u2",
        targetStatus: "Inactif",
      })
    ).toBe(false);
  });

  it("chatDisplayName préfère adhérent puis name", () => {
    expect(
      chatDisplayName({
        name: "User",
        adherent: { firstname: "Ada", lastname: "Lovelace" },
      })
    ).toBe("Ada Lovelace");
    expect(chatDisplayName({ name: "User" })).toBe("User");
    expect(chatDisplayName({})).toBe("Membre");
  });

  it("chatContactIdentityMatches — prénom/nom, casse, accents", () => {
    expect(
      chatContactIdentityMatches(
        { firstname: "Thomas", lastname: "Dupont" },
        "th"
      )
    ).toBe(true);
    expect(
      chatContactIdentityMatches(
        { firstname: "Thérèse", lastname: "Martin" },
        "th"
      )
    ).toBe(true);
    expect(
      chatContactIdentityMatches(
        { firstname: "Thérèse", lastname: "Martin" },
        "therese"
      )
    ).toBe(true);
    expect(
      chatContactIdentityMatches(
        { firstname: "Sidonie", lastname: "Bernard" },
        "th"
      )
    ).toBe(false);
    expect(
      chatContactIdentityMatches(
        { firstname: "Sidonie", lastname: "Authier" },
        "th"
      )
    ).toBe(true);
    expect(
      chatContactIdentityMatches(
        { firstname: "Alice", lastname: "Martin" },
        "MARTIN"
      )
    ).toBe(true);
    expect(
      chatContactIdentityMatches({ firstname: null, lastname: null }, "th")
    ).toBe(false);
  });

  it("conversationDisplayTitle 1:1 / groupe", () => {
    expect(
      conversationDisplayTitle({
        type: "Privee",
        titre: null,
        actorUserId: "u1",
        participants: [
          { userId: "u1", displayName: "Moi" },
          { userId: "u2", displayName: "Bob" },
        ],
      })
    ).toBe("Bob");
    expect(
      conversationDisplayTitle({
        type: "Groupe",
        titre: "Bureau",
        actorUserId: "u1",
        participants: [],
      })
    ).toBe("Bureau");
  });

  it("messagePreview + pagination clamps", () => {
    expect(messagePreview("a".repeat(100)).endsWith("…")).toBe(true);
    expect(clampConversationsPagination({ limit: 999 }).limit).toBe(50);
    expect(clampMessagesPagination({ page: 0, limit: 100 })).toEqual({
      page: 1,
      limit: 50,
    });
    expect(chatNotificationLien("c1")).toBe("/chat/c1");
  });
});
