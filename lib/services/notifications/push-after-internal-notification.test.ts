import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendPushToUser, sendPushToUsers } = vi.hoisted(() => ({
  sendPushToUser: vi.fn(),
  sendPushToUsers: vi.fn(),
}));

vi.mock("@/lib/services/push/send-push", () => ({
  sendPushToUser,
  sendPushToUsers,
}));

import {
  buildPushPayloadFromInternalNotification,
  pushAfterInternalNotification,
  pushAfterInternalNotifications,
  truncatePushBody,
} from "@/lib/services/notifications/push-after-internal-notification";

describe("truncatePushBody / buildPushPayloadFromInternalNotification", () => {
  it("tronque les messages longs sans exposer de token", () => {
    const long = "A".repeat(300);
    const body = truncatePushBody(long);
    expect(body.length).toBeLessThanOrEqual(160);
    expect(body.endsWith("…")).toBe(true);
  });

  it("utilise le lien comme data.url, sinon /notifications", () => {
    expect(
      buildPushPayloadFromInternalNotification({
        titre: "Rappel",
        message: "Contenu",
        lien: "/evenements/e1",
      })
    ).toEqual({
      title: "Rappel",
      body: "Contenu",
      data: { url: "/evenements/e1" },
    });

    expect(
      buildPushPayloadFromInternalNotification({
        titre: "Info",
        message: "Sans lien",
      }).data
    ).toEqual({ url: "/notifications" });
  });
});

describe("pushAfterInternalNotification(s)", () => {
  beforeEach(() => {
    sendPushToUser.mockReset();
    sendPushToUsers.mockReset();
    sendPushToUser.mockResolvedValue({
      attempted: 1,
      ok: 1,
      errors: 0,
      disabled: 0,
    });
    sendPushToUsers.mockResolvedValue({
      attempted: 2,
      ok: 2,
      errors: 0,
      disabled: 0,
    });
  });

  it("envoie un push unique pour un user", async () => {
    await pushAfterInternalNotification("user-a", {
      titre: "Admin",
      message: "Message admin",
      lien: "/notifications",
    });

    expect(sendPushToUser).toHaveBeenCalledTimes(1);
    expect(sendPushToUser).toHaveBeenCalledWith("user-a", {
      title: "Admin",
      body: "Message admin",
      data: { url: "/notifications" },
    });
    expect(sendPushToUsers).not.toHaveBeenCalled();
  });

  it("envoie un push groupé aux bons userIds (dédupliqués)", async () => {
    await pushAfterInternalNotifications(["u1", "u2", "u1"], {
      titre: "Groupe",
      message: "Hello",
      lien: "/agenda",
    });

    expect(sendPushToUsers).toHaveBeenCalledTimes(1);
    expect(sendPushToUsers).toHaveBeenCalledWith(["u1", "u2"], {
      title: "Groupe",
      body: "Hello",
      data: { url: "/agenda" },
    });
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it("échec push absorbé — ne throw pas", async () => {
    sendPushToUser.mockRejectedValue(new Error("Expo down"));
    await expect(
      pushAfterInternalNotification("user-a", {
        titre: "T",
        message: "M",
      })
    ).resolves.toBeUndefined();
  });

  it("userId vide → no-op", async () => {
    await pushAfterInternalNotification("", { titre: "T", message: "M" });
    expect(sendPushToUser).not.toHaveBeenCalled();
  });
});
