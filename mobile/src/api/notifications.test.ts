import { beforeEach, describe, expect, it, vi } from "vitest";

const { authenticatedFetch } = vi.hoisted(() => ({
  authenticatedFetch: vi.fn(),
}));

vi.mock("@/auth/session", () => ({ authenticatedFetch }));

import {
  buildNotificationsQuery,
  deleteNotification,
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@/api/notifications";

describe("buildNotificationsQuery", () => {
  it("n'inclut jamais userId / adherentId", () => {
    const qs = buildNotificationsQuery({ limit: 50, offset: 0, lue: false });
    expect(qs).toContain("limit=50");
    expect(qs).toContain("offset=0");
    expect(qs).toContain("lue=false");
    expect(qs).not.toContain("userId");
    expect(qs).not.toContain("adherentId");
  });
});

describe("notifications API client", () => {
  beforeEach(() => {
    authenticatedFetch.mockReset();
  });

  it("getNotifications appelle le bon path", async () => {
    authenticatedFetch.mockResolvedValue([]);
    await getNotifications({ limit: 50, offset: 0 });
    expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/v1/me/notifications?limit=50&offset=0"
    );
  });

  it("getUnreadNotificationCount", async () => {
    authenticatedFetch.mockResolvedValue({ count: 3 });
    await expect(getUnreadNotificationCount()).resolves.toBe(3);
    expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/v1/me/notifications/unread-count"
    );
  });

  it("markNotificationAsRead PATCH", async () => {
    authenticatedFetch.mockResolvedValue({ updated: true });
    await markNotificationAsRead("n1");
    expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/v1/me/notifications/n1/read",
      { method: "PATCH" }
    );
  });

  it("markAllNotificationsAsRead POST", async () => {
    authenticatedFetch.mockResolvedValue({ count: 2 });
    await markAllNotificationsAsRead();
    expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/v1/me/notifications/read-all",
      { method: "POST" }
    );
  });

  it("deleteNotification DELETE", async () => {
    authenticatedFetch.mockResolvedValue({ deleted: true });
    await deleteNotification("n2");
    expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/v1/me/notifications/n2",
      { method: "DELETE" }
    );
  });
});
