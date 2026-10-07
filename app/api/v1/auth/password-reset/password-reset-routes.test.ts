import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/lib/service-error";
import { PASSWORD_RESET_REQUEST_MESSAGE } from "@/lib/auth/password-reset-messages";

const { requestChallenge, confirmChallenge } = vi.hoisted(() => ({
  requestChallenge: vi.fn(),
  confirmChallenge: vi.fn(),
}));

vi.mock("@/lib/services/auth/password-reset-request", () => ({
  requestPasswordResetChallenge: requestChallenge,
}));
vi.mock("@/lib/services/auth/password-reset-confirm", () => ({
  confirmPasswordResetChallenge: confirmChallenge,
}));
vi.mock("@/lib/auth/password-reset-client-ip", () => ({
  getPasswordResetClientIp: () => "203.0.113.10",
}));

import { POST as requestPost } from "@/app/api/v1/auth/password-reset/request/route";
import { POST as confirmPost } from "@/app/api/v1/auth/password-reset/confirm/route";

function jsonReq(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

describe("API password-reset", () => {
  beforeEach(() => {
    requestChallenge.mockReset();
    confirmChallenge.mockReset();
  });

  it("request + confirm passent clientIp (même forme publique)", async () => {
    requestChallenge.mockResolvedValue({
      accepted: true,
      message: PASSWORD_RESET_REQUEST_MESSAGE,
      retryAfter: 60,
    });
    const reqRes = await requestPost(
      jsonReq("http://localhost/api/v1/auth/password-reset/request", {
        email: "user@amaki.fr",
      })
    );
    expect((await reqRes.json()).data.message).toBe(
      PASSWORD_RESET_REQUEST_MESSAGE
    );
    expect(requestChallenge).toHaveBeenCalledWith("user@amaki.fr", {
      clientIp: "203.0.113.10",
    });

    confirmChallenge.mockResolvedValue({ success: true, message: "ok" });
    await confirmPost(
      jsonReq("http://localhost/api/v1/auth/password-reset/confirm", {
        email: "a@b.com",
        code: "12345678",
        password: "abcdef",
        confirmPassword: "abcdef",
      })
    );
    expect(confirmChallenge).toHaveBeenCalledWith(
      expect.objectContaining({ clientIp: "203.0.113.10", code: "12345678" })
    );
  });

  it("confirm refus générique", async () => {
    confirmChallenge.mockRejectedValue(
      new ServiceError(
        "UNAUTHENTICATED",
        "Réinitialisation impossible. Vérifiez les informations ou demandez un nouveau code."
      )
    );
    const res = await confirmPost(
      jsonReq("http://localhost/api/v1/auth/password-reset/confirm", {
        email: "a@b.com",
        code: "12345678",
        password: "abcdef",
        confirmPassword: "abcdef",
      })
    );
    expect(res.status).toBe(401);
  });
});
