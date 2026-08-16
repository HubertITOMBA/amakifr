import { describe, expect, it } from "vitest";
import {
  nextUnreadAfterDelete,
  nextUnreadAfterMarkAll,
  nextUnreadAfterMarkRead,
  formatNotificationDate,
  notificationErrorMessage,
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
