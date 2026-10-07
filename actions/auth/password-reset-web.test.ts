import { beforeEach, describe, expect, it, vi } from "vitest";
import { PASSWORD_RESET_REQUEST_MESSAGE } from "@/lib/auth/password-reset-messages";
import { ServiceError } from "@/lib/service-error";

const { requestChallenge, confirmChallenge, getIp } = vi.hoisted(() => ({
  requestChallenge: vi.fn(),
  confirmChallenge: vi.fn(),
  getIp: vi.fn(),
}));

vi.mock("@/lib/services/auth/password-reset-request", () => ({
  requestPasswordResetChallenge: requestChallenge,
}));
vi.mock("@/lib/services/auth/password-reset-confirm", () => ({
  confirmPasswordResetChallenge: confirmChallenge,
}));
vi.mock("@/lib/auth/password-reset-client-ip", () => ({
  getPasswordResetClientIpFromAction: getIp,
}));
// getIp utilisé by reset + newPassword

import { reset } from "@/actions/auth/reset";
import { newPassword } from "@/actions/auth/new-password";

describe("parcours web password-reset", () => {
  beforeEach(() => {
    requestChallenge.mockReset();
    confirmChallenge.mockReset();
    getIp.mockReset();
    getIp.mockResolvedValue("10.0.0.1");
  });

  it("reset : réponse générique anti-énumération", async () => {
    requestChallenge.mockResolvedValue({
      accepted: true,
      message: PASSWORD_RESET_REQUEST_MESSAGE,
      retryAfter: 60,
    });
    const res = await reset({ email: "user@amaki.fr" });
    expect(res.success).toBe(PASSWORD_RESET_REQUEST_MESSAGE);
    expect(requestChallenge).toHaveBeenCalledWith("user@amaki.fr", {
      clientIp: "10.0.0.1",
    });
  });

  it("newPassword : délègue au service confirm avec clientIp", async () => {
    confirmChallenge.mockResolvedValue({
      success: true,
      message: "ok",
    });
    const res = await newPassword({
      email: "a@b.com",
      code: "12345678",
      password: "abcdef",
      confirmPassword: "abcdef",
    });
    expect(res.success).toBe("ok");
    expect(confirmChallenge).toHaveBeenCalledWith({
      email: "a@b.com",
      code: "12345678",
      password: "abcdef",
      confirmPassword: "abcdef",
      clientIp: "10.0.0.1",
    });
  });

  it("newPassword : erreur générique métier", async () => {
    confirmChallenge.mockRejectedValue(
      new ServiceError("UNAUTHENTICATED", "Réinitialisation impossible. Vérifiez les informations ou demandez un nouveau code.")
    );
    const res = await newPassword({
      email: "a@b.com",
      code: "12345678",
      password: "abcdef",
      confirmPassword: "abcdef",
    });
    expect(res.error).toMatch(/Réinitialisation impossible/);
  });
});
