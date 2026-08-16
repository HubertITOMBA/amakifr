import { describe, expect, it } from "vitest";
import { isServiceError, ServiceError } from "@/lib/service-error";

describe("ServiceError", () => {
  it("crée une erreur avec code et message", () => {
    const err = new ServiceError("NOT_FOUND", "Introuvable");
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("Introuvable");
    expect(err.name).toBe("ServiceError");
  });

  it("accepte details optionnel", () => {
    const details = { field: "email" };
    const err = new ServiceError("VALIDATION_ERROR", "Invalide", details);
    expect(err.details).toEqual(details);
  });

  it("est une instance de Error", () => {
    const err = new ServiceError("INTERNAL_ERROR", "Boom");
    expect(err).toBeInstanceOf(Error);
  });

  it("est une instance de ServiceError", () => {
    const err = new ServiceError("FORBIDDEN", "Refusé");
    expect(err).toBeInstanceOf(ServiceError);
  });

  it("isServiceError retourne true pour ServiceError", () => {
    expect(isServiceError(new ServiceError("CONFLICT", "Conflit"))).toBe(true);
  });

  it("isServiceError retourne false pour les autres valeurs", () => {
    expect(isServiceError(new Error("x"))).toBe(false);
    expect(isServiceError(null)).toBe(false);
    expect(isServiceError({ code: "NOT_FOUND" })).toBe(false);
    expect(isServiceError("NOT_FOUND")).toBe(false);
  });
});
