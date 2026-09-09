import { describe, expect, it } from "vitest";
import { notificationLinkToMobileRoute } from "@/api/notification-link";

describe("notificationLinkToMobileRoute", () => {
  it("chat → messages", () => {
    expect(notificationLinkToMobileRoute("/chat/abc")).toBe("/messages/abc");
  });

  it("paiement → cotisations", () => {
    expect(notificationLinkToMobileRoute("/paiement")).toBe("/cotisations");
  });

  it("evenement détail", () => {
    expect(notificationLinkToMobileRoute("/evenements/e1")).toBe(
      "/evenements/e1"
    );
  });

  it("fallback notifications", () => {
    expect(notificationLinkToMobileRoute("/unknown/path")).toBe(
      "/notifications"
    );
  });

  it("null / vide", () => {
    expect(notificationLinkToMobileRoute(null)).toBeNull();
    expect(notificationLinkToMobileRoute("")).toBeNull();
  });

  it("URL absolue", () => {
    expect(
      notificationLinkToMobileRoute("https://amaki.fr/chat/xyz")
    ).toBe("/messages/xyz");
  });
});
