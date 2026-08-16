import { describe, expect, it } from "vitest";
import { requirePathId } from "@/lib/api/validation/path-id";
import { ServiceError } from "@/lib/service-error";

describe("requirePathId", () => {
  it("retourne l'id trimé", () => {
    expect(requirePathId("  abc-123  ")).toBe("abc-123");
  });

  it("vide → VALIDATION_ERROR", () => {
    expect(() => requirePathId("")).toThrow(ServiceError);
    expect(() => requirePathId("   ")).toThrow(
      expect.objectContaining({ code: "VALIDATION_ERROR" })
    );
  });

  it("null/undefined → VALIDATION_ERROR", () => {
    expect(() => requirePathId(null)).toThrow(
      expect.objectContaining({ code: "VALIDATION_ERROR" })
    );
    expect(() => requirePathId(undefined)).toThrow(
      expect.objectContaining({ code: "VALIDATION_ERROR" })
    );
  });
});
