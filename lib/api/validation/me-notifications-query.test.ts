import { describe, expect, it } from "vitest";
import { parseMeNotificationsQuery } from "@/lib/api/validation/me-notifications-query";
import { ServiceError } from "@/lib/service-error";

describe("parseMeNotificationsQuery", () => {
  it("accepte lue/type/limit/offset", () => {
    const sp = new URLSearchParams({
      lue: "true",
      type: "Systeme",
      limit: "10",
      offset: "5",
    });
    expect(parseMeNotificationsQuery(sp)).toEqual({
      lue: true,
      type: "Systeme",
      limit: 10,
      offset: 5,
    });
  });

  it("refuse limit > 100", () => {
    expect(() =>
      parseMeNotificationsQuery(new URLSearchParams({ limit: "101" }))
    ).toThrow(ServiceError);
    try {
      parseMeNotificationsQuery(new URLSearchParams({ limit: "101" }));
    } catch (e) {
      expect(e).toMatchObject({ code: "VALIDATION_ERROR" });
    }
  });

  it("refuse userId / adherentId", () => {
    try {
      parseMeNotificationsQuery(new URLSearchParams({ userId: "x" }));
      expect.fail("should throw");
    } catch (e) {
      expect(e).toMatchObject({ code: "VALIDATION_ERROR" });
    }
    try {
      parseMeNotificationsQuery(new URLSearchParams({ adherentId: "y" }));
      expect.fail("should throw");
    } catch (e) {
      expect(e).toMatchObject({ code: "VALIDATION_ERROR" });
    }
  });
});
