import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("EXPO_PUBLIC_API_URL", "http://example.test:9052");

const apiRequest = vi.fn();

vi.mock("@/auth/session", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));

import {
  PASSWORD_RESET_CONFIRM_PATH,
  PASSWORD_RESET_REQUEST_PATH,
  confirmPasswordReset,
  passwordResetConfirmUrl,
  passwordResetRequestUrl,
  requestPasswordReset,
} from "@/api/password-reset";

describe("password-reset API client", () => {
  beforeEach(() => {
    apiRequest.mockReset();
  });

  it("URL correctes via EXPO_PUBLIC_API_URL", () => {
    expect(passwordResetRequestUrl()).toBe(
      `http://example.test:9052${PASSWORD_RESET_REQUEST_PATH}`
    );
    expect(passwordResetConfirmUrl()).toBe(
      `http://example.test:9052${PASSWORD_RESET_CONFIRM_PATH}`
    );
  });

  it("payload request normalisé ; pas de Bearer", async () => {
    apiRequest.mockResolvedValue({
      accepted: true,
      message: "Si un compte correspond…",
      retryAfter: 60,
    });
    const res = await requestPasswordReset("  User@Amaki.FR ");
    expect(res.accepted).toBe(true);
    expect(apiRequest).toHaveBeenCalledWith(
      PASSWORD_RESET_REQUEST_PATH,
      expect.objectContaining({
        method: "POST",
        body: { email: "user@amaki.fr" },
        skipAuthRetry: true,
        accessToken: null,
      })
    );
    const opts = apiRequest.mock.calls[0][1] as Record<string, unknown>;
    expect(opts).not.toHaveProperty("Authorization");
    expect(JSON.stringify(opts)).not.toMatch(/Bearer/);
  });

  it("payload confirm exact", async () => {
    apiRequest.mockResolvedValue({
      success: true,
      message: "ok",
    });
    await confirmPasswordReset({
      email: "A@B.com",
      code: "12345678",
      password: "secret1",
      confirmPassword: "secret1",
    });
    expect(apiRequest).toHaveBeenCalledWith(
      PASSWORD_RESET_CONFIRM_PATH,
      expect.objectContaining({
        method: "POST",
        body: {
          email: "a@b.com",
          code: "12345678",
          password: "secret1",
          confirmPassword: "secret1",
        },
        skipAuthRetry: true,
        accessToken: null,
      })
    );
  });

  it("erreur réseau propagée", async () => {
    const { ApiClientError } = await import("@/api/types");
    apiRequest.mockRejectedValue(
      new ApiClientError(0, "NETWORK_ERROR", "Serveur injoignable")
    );
    await expect(requestPasswordReset("a@b.com")).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
  });

  it("erreur validation propagée", async () => {
    const { ApiClientError } = await import("@/api/types");
    apiRequest.mockRejectedValue(
      new ApiClientError(400, "VALIDATION_ERROR", "Un email valide est requis")
    );
    await expect(requestPasswordReset("x")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("réponse accepted request", async () => {
    apiRequest.mockResolvedValue({
      accepted: true,
      message: "Si un compte correspond à cette adresse, un code de réinitialisation sera envoyé.",
      retryAfter: 60,
    });
    const r = await requestPasswordReset("a@b.com");
    expect(r.accepted).toBe(true);
    expect(r.retryAfter).toBe(60);
  });
});
