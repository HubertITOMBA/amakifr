import { describe, expect, it } from "vitest";
import {
  buildPrivateConversationPayload,
  chatErrorMessage,
  conversationThreadHref,
  formatChatListWhen,
  formatChatMessageWhen,
  shouldShowHomeChatBadge,
} from "@/api/chat-state";

describe("chat-state", () => {
  it("badge home", () => {
    expect(shouldShowHomeChatBadge(0)).toBe(false);
    expect(shouldShowHomeChatBadge(2)).toBe(true);
  });

  it("format message when", () => {
    const now = new Date("2026-09-07T18:00:00");
    const today = formatChatMessageWhen("2026-09-07T17:42:00", now);
    expect(today).toContain("Aujourd'hui");
    expect(formatChatListWhen("2026-09-07T17:42:00", now)).toMatch(/\d{2}:\d{2}/);
  });

  it("error message", () => {
    expect(chatErrorMessage({ message: "x" })).toBe("x");
    expect(chatErrorMessage(null)).toMatch(/erreur/i);
  });

  it("select contact → payload User.id + href Conversation.id", () => {
    const contact = { id: "user-bob", displayName: "Bob", image: null };
    const payload = buildPrivateConversationPayload(contact.id);
    expect(payload).toEqual({
      type: "Privee",
      participantIds: ["user-bob"],
    });
    expect(payload).not.toHaveProperty("userId");
    expect(payload).not.toHaveProperty("senderId");
    expect(conversationThreadHref("conv-123")).toBe("/messages/conv-123");
  });
});
