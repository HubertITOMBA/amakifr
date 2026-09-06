import { describe, expect, it } from "vitest";
import {
  nextUnreadAfterDelete,
  nextUnreadAfterMarkAll,
  nextUnreadAfterMarkRead,
  formatNotificationDate,
  formatTabUnreadBadge,
  notificationErrorMessage,
  shouldRefreshUnreadOnAppState,
} from "@/api/notifications-state";

describe("unread count helpers", () => {
  it("mark read non lue : 3 → 2", () => {
    expect(nextUnreadAfterMarkRead(3, true)).toBe(2);
  });

  it("mark read déjà lue : reste 3", () => {
    expect(nextUnreadAfterMarkRead(3, false)).toBe(3);
  });

  it("delete non lue : 3 → 2", () => {
    expect(nextUnreadAfterDelete(3, true)).toBe(2);
  });

  it("delete lue : reste 3", () => {
    expect(nextUnreadAfterDelete(3, false)).toBe(3);
  });

  it("mark all → 0", () => {
    expect(nextUnreadAfterMarkAll()).toBe(0);
  });

  it("jamais négatif", () => {
    expect(nextUnreadAfterMarkRead(0, true)).toBe(0);
    expect(nextUnreadAfterDelete(0, true)).toBe(0);
  });
});

describe("formatTabUnreadBadge", () => {
  it("0 → badge absent", () => {
    expect(formatTabUnreadBadge(0)).toBeUndefined();
  });

  it(">0 → badge visible", () => {
    expect(formatTabUnreadBadge(1)).toBe(1);
    expect(formatTabUnreadBadge(12)).toBe(12);
  });

  it("très élevé → 99+", () => {
    expect(formatTabUnreadBadge(100)).toBe("99+");
  });
});

describe("shouldRefreshUnreadOnAppState", () => {
  it("background → active : refresh", () => {
    expect(shouldRefreshUnreadOnAppState("background", "active")).toBe(true);
  });

  it("inactive → active : refresh", () => {
    expect(shouldRefreshUnreadOnAppState("inactive", "active")).toBe(true);
  });

  it("active → active : pas de refetch", () => {
    expect(shouldRefreshUnreadOnAppState("active", "active")).toBe(false);
  });

  it("active → background : pas de refresh count", () => {
    expect(shouldRefreshUnreadOnAppState("active", "background")).toBe(false);
  });

  it("premier mount (prev null) : pas de double refresh AppState", () => {
    expect(shouldRefreshUnreadOnAppState(null, "active")).toBe(false);
  });
});

describe("formatNotificationDate", () => {
  it("date invalide → tiret", () => {
    expect(formatNotificationDate("not-a-date")).toBe("—");
  });
});

describe("notificationErrorMessage", () => {
  it("429", () => {
    expect(
      notificationErrorMessage({
        status: 429,
        code: "RATE_LIMITED",
        message: "x",
      })
    ).toContain("Trop de requêtes");
  });

  it("network", () => {
    expect(
      notificationErrorMessage({
        status: 0,
        code: "NETWORK_ERROR",
        message: "x",
      })
    ).toContain("injoignable");
  });
});
