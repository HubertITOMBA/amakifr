import { describe, expect, it } from "vitest";
import { sanitizeNotificationLink } from "@/lib/services/notifications/sanitize-notification-link";

describe("sanitizeNotificationLink", () => {
  it("autorise un chemin interne /admin/test", () => {
    expect(sanitizeNotificationLink("/admin/test")).toEqual({
      kind: "internal",
      href: "/admin/test",
    });
  });

  it("autorise https://example.com", () => {
    expect(sanitizeNotificationLink("https://example.com")).toEqual({
      kind: "external",
      href: "https://example.com/",
    });
  });

  it("autorise http://example.com", () => {
    expect(sanitizeNotificationLink("http://example.com")).toEqual({
      kind: "external",
      href: "http://example.com/",
    });
  });

  it("refuse //evil.example", () => {
    expect(sanitizeNotificationLink("//evil.example")).toEqual({
      kind: "unsafe",
      raw: "//evil.example",
    });
  });

  it("refuse javascript:alert(1)", () => {
    expect(sanitizeNotificationLink("javascript:alert(1)")).toEqual({
      kind: "unsafe",
      raw: "javascript:alert(1)",
    });
  });

  it("refuse data:text/html", () => {
    expect(sanitizeNotificationLink("data:text/html")).toEqual({
      kind: "unsafe",
      raw: "data:text/html",
    });
  });

  it("refuse une chaîne vide", () => {
    expect(sanitizeNotificationLink("")).toEqual({ kind: "empty" });
    expect(sanitizeNotificationLink("   ")).toEqual({ kind: "empty" });
    expect(sanitizeNotificationLink(null)).toEqual({ kind: "empty" });
    expect(sanitizeNotificationLink(undefined)).toEqual({ kind: "empty" });
  });
});
