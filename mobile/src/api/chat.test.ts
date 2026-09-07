import { beforeEach, describe, expect, it, vi } from "vitest";

const { authenticatedFetch } = vi.hoisted(() => ({
  authenticatedFetch: vi.fn(),
}));

vi.mock("@/auth/session", () => ({
  authenticatedFetch,
}));

import {
  createMyConversation,
  sendMyMessage,
} from "@/api/chat";

describe("chat API client body", () => {
  beforeEach(() => {
    authenticatedFetch.mockReset();
  });

  it("createMyConversation envoie un objet (pas JSON.stringify)", async () => {
    authenticatedFetch.mockResolvedValue({ id: "c1" });
    await createMyConversation({
      type: "Privee",
      participantIds: ["user-b"],
    });
    expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/v1/me/chat/conversations",
      expect.objectContaining({
        method: "POST",
        body: {
          type: "Privee",
          participantIds: ["user-b"],
        },
      })
    );
    const body = authenticatedFetch.mock.calls[0][1].body;
    expect(typeof body).toBe("object");
    expect(typeof body).not.toBe("string");
  });

  it("sendMyMessage body objet", async () => {
    authenticatedFetch.mockResolvedValue({
      message: { id: "m1", content: "Hi" },
    });
    await sendMyMessage("c1", "Hi");
    expect(authenticatedFetch.mock.calls[0][1].body).toEqual({
      content: "Hi",
    });
  });
});
