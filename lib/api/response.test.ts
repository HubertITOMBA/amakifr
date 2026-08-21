import { describe, expect, it } from "vitest";
import { ServiceError } from "@/lib/service-error";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError, SERVICE_ERROR_HTTP_STATUS } from "@/lib/api/errors";

async function readJson(res: Response) {
  return res.json();
}

describe("apiSuccess / apiError", () => {
  it("apiSuccess avec data", async () => {
    const res = apiSuccess({ id: "1" });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await readJson(res);
    expect(body).toEqual({ success: true, data: { id: "1" } });
  });

  it("apiSuccess sans data", async () => {
    const body = await readJson(apiSuccess());
    expect(body).toEqual({ success: true });
  });

  it("apiError sans stack", async () => {
    const res = apiError("NOT_FOUND", "Introuvable", 404);
    expect(res.status).toBe(404);
    const body = await readJson(res);
    expect(body).toEqual({
      success: false,
      error: { code: "NOT_FOUND", message: "Introuvable" },
    });
    expect(JSON.stringify(body)).not.toMatch(/stack|prisma|sql/i);
  });
});

describe("handleApiError / SERVICE_ERROR_HTTP_STATUS", () => {
  it("mappe tous les codes ServiceError vers le bon status", async () => {
    const cases: Array<[keyof typeof SERVICE_ERROR_HTTP_STATUS, number]> = [
      ["VALIDATION_ERROR", 400],
      ["UNAUTHENTICATED", 401],
      ["FORBIDDEN", 403],
      ["NOT_FOUND", 404],
      ["CONFLICT", 409],
      ["PAYMENT_ALREADY_PENDING", 409],
      ["PAYMENT_EXCEEDS_REMAINING", 409],
      ["RATE_LIMITED", 429],
      ["INTERNAL_ERROR", 500],
    ];

    for (const [code, status] of cases) {
      const res = handleApiError(new ServiceError(code, `msg-${code}`));
      expect(res.status).toBe(status);
      const body = await readJson(res);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(code);
      if (code === "INTERNAL_ERROR") {
        expect(body.error.message).toBe("Erreur interne du serveur");
      } else {
        expect(body.error.message).toBe(`msg-${code}`);
      }
    }
  });

  it("erreur inconnue -> 500 générique sans stack", async () => {
    const err = new Error("secret SQL SELECT * FROM users");
    const res = handleApiError(err);
    expect(res.status).toBe(500);
    const body = await readJson(res);
    expect(body).toEqual({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Erreur interne du serveur",
      },
    });
    expect(JSON.stringify(body)).not.toContain("SQL");
    expect(JSON.stringify(body)).not.toContain("stack");
  });
});
