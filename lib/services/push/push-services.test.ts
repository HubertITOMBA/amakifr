import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth-context";

const { upsert, deleteMany, findMany, updateMany } = vi.hoisted(() => ({
  upsert: vi.fn(),
  deleteMany: vi.fn(),
  findMany: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    mobilePushToken: {
      upsert,
      deleteMany,
      findMany,
      updateMany,
    },
  },
}));

import { registerMyPushToken } from "@/lib/services/push/register-my-push-token";
import { removeMyPushToken } from "@/lib/services/push/remove-my-push-token";
import {
  disablePushTokens,
  sanitizeExpoPushMessageForLog,
  sanitizeExpoPushTicketForLog,
  sendPushToUser,
  sendPushToUsers,
} from "@/lib/services/push/send-push";
import type { ExpoPushHttpClient } from "@/lib/services/push/types";

const actor = (id = "user-a"): AuthContext =>
  ({
    userId: id,
    email: `${id}@ex.com`,
    name: "A",
    role: "MEMBRE",
    status: "Actif",
  }) as AuthContext;

const TOKEN_A = "ExponentPushToken[aaaaaaaaaaaaaaaaaaaa]";
const TOKEN_B = "ExponentPushToken[bbbbbbbbbbbbbbbbbbbb]";

describe("sanitizeExpoPush", () => {
  it("redacte le token et expose channelId/priority", () => {
    const s = sanitizeExpoPushMessageForLog({
      to: TOKEN_A,
      title: "Nouveau message",
      body: "Vous avez reçu un nouveau message.",
      sound: "default",
      channelId: "amaki_alerts",
      priority: "high",
      data: { url: "/chat/c1" },
    });
    expect(String(s.to)).not.toContain("aaaaaaaa");
    expect(s.channelId).toBe("amaki_alerts");
    expect(s.priority).toBe("high");
  });

  it("ticket ok → idPresent bool", () => {
    expect(sanitizeExpoPushTicketForLog({ status: "ok", id: "tid" })).toEqual({
      status: "ok",
      idPresent: true,
    });
  });
});

describe("registerMyPushToken", () => {
  beforeEach(() => {
    upsert.mockReset();
    upsert.mockResolvedValue({
      id: "t1",
      token: TOKEN_A,
      platform: "android",
      lastSeenAt: new Date("2026-09-08T10:00:00.000Z"),
    });
  });

  it("register self", async () => {
    const r = await registerMyPushToken(actor(), {
      token: TOKEN_A,
      platform: "android",
      deviceName: "A54",
    });
    expect(r.token).toBe(TOKEN_A);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token: TOKEN_A },
        create: expect.objectContaining({ userId: "user-a", disabledAt: null }),
        update: expect.objectContaining({ userId: "user-a", disabledAt: null }),
      })
    );
  });

  it("upsert réattache token autre user (cross-compte)", async () => {
    await registerMyPushToken(actor("user-b"), {
      token: TOKEN_A,
      platform: "android",
    });
    expect(upsert.mock.calls[0][0].update.userId).toBe("user-b");
  });

  it("refuse token invalide", async () => {
    await expect(
      registerMyPushToken(actor(), { token: "bad", platform: "android" })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("refuse platform hors whitelist", async () => {
    await expect(
      registerMyPushToken(actor(), { token: TOKEN_A, platform: "web" })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe("removeMyPushToken", () => {
  beforeEach(() => {
    deleteMany.mockReset();
  });

  it("remove self", async () => {
    deleteMany.mockResolvedValue({ count: 1 });
    const r = await removeMyPushToken(actor(), { token: TOKEN_A });
    expect(r.removed).toBe(true);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { token: TOKEN_A, userId: "user-a" },
    });
  });

  it("remove autre user → removed false (filtre userId)", async () => {
    deleteMany.mockResolvedValue({ count: 0 });
    const r = await removeMyPushToken(actor("user-b"), { token: TOKEN_A });
    expect(r.removed).toBe(false);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { token: TOKEN_A, userId: "user-b" },
    });
  });
});

describe("sendPushToUsers", () => {
  beforeEach(() => {
    findMany.mockReset();
    updateMany.mockReset();
  });

  it("aucun token → no-op", async () => {
    findMany.mockResolvedValue([]);
    const client: ExpoPushHttpClient = { send: vi.fn() };
    const r = await sendPushToUsers(
      ["user-a"],
      { title: "t", body: "b" },
      client
    );
    expect(r.attempted).toBe(0);
    expect(client.send).not.toHaveBeenCalled();
  });

  it("un token ok", async () => {
    findMany.mockResolvedValue([{ token: TOKEN_A, platform: "android" }]);
    const client: ExpoPushHttpClient = {
      send: vi.fn().mockResolvedValue([{ status: "ok", id: "1" }]),
    };
    const r = await sendPushToUser(
      "user-a",
      { title: "t", body: "b", data: { url: "/chat/1" } },
      client
    );
    expect(r.ok).toBe(1);
    expect(r.attempted).toBe(1);
    expect(client.send).toHaveBeenCalledWith([
      expect.objectContaining({
        channelId: "amaki_alerts",
        priority: "high",
        sound: "default",
        data: { url: "/chat/1" },
      }),
    ]);
  });

  it("plusieurs tokens", async () => {
    findMany.mockResolvedValue([
      { token: TOKEN_A, platform: "android" },
      { token: TOKEN_B, platform: "ios" },
    ]);
    const client: ExpoPushHttpClient = {
      send: vi
        .fn()
        .mockResolvedValue([
          { status: "ok", id: "1" },
          { status: "ok", id: "2" },
        ]),
    };
    const r = await sendPushToUsers(
      ["user-a"],
      { title: "t", body: "b" },
      client
    );
    expect(r.ok).toBe(2);
  });

  it("DeviceNotRegistered → disable", async () => {
    findMany.mockResolvedValue([{ token: TOKEN_A, platform: "android" }]);
    updateMany.mockResolvedValue({ count: 1 });
    const client: ExpoPushHttpClient = {
      send: vi.fn().mockResolvedValue([
        {
          status: "error",
          message: "gone",
          details: { error: "DeviceNotRegistered" },
        },
      ]),
    };
    const r = await sendPushToUser(
      "user-a",
      { title: "t", body: "b" },
      client
    );
    expect(r.disabled).toBe(1);
    expect(updateMany).toHaveBeenCalled();
  });

  it("timeout / 5xx → ne désactive pas", async () => {
    findMany.mockResolvedValue([{ token: TOKEN_A, platform: "android" }]);
    const client: ExpoPushHttpClient = {
      send: vi.fn().mockRejectedValue(new Error("timeout")),
    };
    const r = await sendPushToUser(
      "user-a",
      { title: "t", body: "b" },
      client
    );
    expect(r.errors).toBe(1);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("failure no rollback (pas de throw)", async () => {
    findMany.mockRejectedValue(new Error("db down"));
    await expect(
      sendPushToUsers(["user-a"], { title: "t", body: "b" })
    ).resolves.toMatchObject({ attempted: 0 });
  });
});

describe("disablePushTokens", () => {
  it("noop si vide", async () => {
    expect(await disablePushTokens([])).toBe(0);
  });
});
