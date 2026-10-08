import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/api/types";
import {
  createForgotPasswordFlow,
  navigateToForgotPassword,
} from "@/features/auth/password-reset-flow";
import {
  PASSWORD_RESET_CONFIRM_GENERIC_ERROR,
  PASSWORD_RESET_REQUEST_GENERIC_MESSAGE,
  PASSWORD_RESET_SUCCESS_LOGIN_BANNER,
  __resetPendingLoginBannerForTests,
  consumePendingLoginBanner,
  setPendingLoginBanner,
} from "@/features/auth/password-reset-model";
import { MOBILE_FORGOT_PASSWORD_ROUTE } from "@/features/auth/sign-in-model";

describe("createForgotPasswordFlow — comportemental", () => {
  const request = vi.fn();
  const confirm = vi.fn();
  const replaceSignIn = vi.fn();
  const setPendingBanner = vi.fn();
  let nowMs = 1_000_000;

  function makeFlow() {
    return createForgotPasswordFlow({
      api: { request, confirm },
      nav: { replaceSignIn },
      setPendingBanner,
      now: () => nowMs,
    });
  }

  beforeEach(() => {
    request.mockReset();
    confirm.mockReset();
    replaceSignIn.mockReset();
    setPendingBanner.mockReset();
    __resetPendingLoginBannerForTests();
    nowMs = 1_000_000;
  });

  afterEach(() => {
    __resetPendingLoginBannerForTests();
  });

  it("LoginPage → navigation /forgot-password sans secrets", () => {
    const push = vi.fn();
    navigateToForgotPassword(push, MOBILE_FORGOT_PASSWORD_ROUTE);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/forgot-password");
    expect(push.mock.calls[0]).toHaveLength(1);
    expect(String(push.mock.calls[0][0])).not.toMatch(/[?&]/);
    expect(String(push.mock.calls[0][0])).not.toMatch(/@/);
  });

  it("demande valide → request exact + transition confirm + message générique neutre", async () => {
    request.mockResolvedValue({
      accepted: true,
      message: PASSWORD_RESET_REQUEST_GENERIC_MESSAGE,
      retryAfter: 60,
    });
    const flow = makeFlow();
    flow.setEmail("  User@Amaki.FR ");
    const ok = await flow.requestCode(false);
    expect(ok).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith("user@amaki.fr");
    const s = flow.getState();
    expect(s.step).toBe("confirm");
    expect(s.info).toBe(PASSWORD_RESET_REQUEST_GENERIC_MESSAGE);
    expect(s.error).toBeNull();
    expect(s.email).toBe("user@amaki.fr");
  });

  it("collage code : filtre avant troncature", () => {
    const flow = makeFlow();
    flow.setCodeFromRaw("12 a34-5678");
    expect(flow.getState().code).toBe("12345678");
    flow.setCodeFromRaw("1234567890");
    expect(flow.getState().code).toBe("12345678");
    flow.setCodeFromRaw("ab cd");
    expect(flow.getState().code).toBe("");
    flow.setCodeFromRaw("12ab 34");
    expect(flow.getState().code).toBe("1234");
  });

  it("yeux indépendants ; valeurs MDP conservées", () => {
    const flow = makeFlow();
    flow.setPassword("secret-A");
    flow.setConfirmPassword("secret-B");
    expect(flow.getState().passwordVisible).toBe(false);
    expect(flow.getState().confirmVisible).toBe(false);
    flow.togglePasswordVisible();
    expect(flow.getState().passwordVisible).toBe(true);
    expect(flow.getState().confirmVisible).toBe(false);
    expect(flow.getState().password).toBe("secret-A");
    expect(flow.getState().confirmPassword).toBe("secret-B");
    flow.toggleConfirmVisible();
    expect(flow.getState().confirmVisible).toBe(true);
    expect(flow.getState().password).toBe("secret-A");
  });

  it("confirmation différente → API non appelée", async () => {
    const flow = makeFlow();
    flow.setEmail("a@b.com");
    flow.setCodeFromRaw("12345678");
    flow.setPassword("secret1");
    flow.setConfirmPassword("secret2");
    const ok = await flow.confirmReset();
    expect(ok).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
    expect(flow.getState().error).toMatch(/ne correspondent pas/);
  });

  it("confirm valide → payload exact", async () => {
    confirm.mockResolvedValue({ success: true, message: "ok" });
    const flow = makeFlow();
    flow.setEmail("A@B.com");
    flow.setCodeFromRaw("12 34-5678");
    flow.setPassword("secret1");
    flow.setConfirmPassword("secret1");
    // passer en confirm n’est pas requis pour l’API
    await flow.confirmReset();
    expect(confirm).toHaveBeenCalledWith({
      email: "a@b.com",
      code: "12345678",
      password: "secret1",
      confirmPassword: "secret1",
    });
  });

  it("double clic request → un seul appel API ; nouvel essai après rejet", async () => {
    let rejectReq!: (e: unknown) => void;
    request.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectReq = reject;
        })
    );
    const flow = makeFlow();
    flow.setEmail("a@b.com");
    const p1 = flow.requestCode(false);
    const p2 = flow.requestCode(false);
    expect(flow.isBusy()).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
    rejectReq!(new ApiClientError(0, "NETWORK_ERROR", "down"));
    expect(await p1).toBe(true);
    expect(await p2).toBe(false);
    expect(flow.isBusy()).toBe(false);

    request.mockResolvedValue({
      accepted: true,
      message: PASSWORD_RESET_REQUEST_GENERIC_MESSAGE,
      retryAfter: 60,
    });
    expect(await flow.requestCode(false)).toBe(true);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("double clic renvoi → un seul appel ; retry après cooldown", async () => {
    request.mockResolvedValue({
      accepted: true,
      message: PASSWORD_RESET_REQUEST_GENERIC_MESSAGE,
      retryAfter: 60,
    });
    const flow = makeFlow();
    flow.setEmail("a@b.com");
    await flow.requestCode(false);
    expect(request).toHaveBeenCalledTimes(1);

    nowMs += 61_000;
    let resolveResend!: (v: unknown) => void;
    request.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveResend = resolve;
        })
    );
    const r1 = flow.requestCode(true);
    const r2 = flow.requestCode(true);
    expect(request).toHaveBeenCalledTimes(2);
    resolveResend!({
      accepted: true,
      message: PASSWORD_RESET_REQUEST_GENERIC_MESSAGE,
      retryAfter: 45,
    });
    expect(await r1).toBe(true);
    expect(await r2).toBe(false);
    expect(flow.getState().code).toBe("");
  });

  it("double clic confirm → un seul appel ; retry après erreur réseau", async () => {
    let rejectConf!: (e: unknown) => void;
    confirm.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectConf = reject;
        })
    );
    const flow = makeFlow();
    flow.setEmail("a@b.com");
    flow.setCodeFromRaw("12345678");
    flow.setPassword("secret1");
    flow.setConfirmPassword("secret1");
    const p1 = flow.confirmReset();
    const p2 = flow.confirmReset();
    expect(confirm).toHaveBeenCalledTimes(1);
    rejectConf!(new ApiClientError(0, "NETWORK_ERROR", "down"));
    expect(await p1).toBe(true);
    expect(await p2).toBe(false);
    expect(flow.getState().error).toMatch(/injoignable/i);

    confirm.mockResolvedValue({ success: true, message: "ok" });
    expect(await flow.confirmReset()).toBe(true);
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it("renvoi accepté → code vidé + cooldown relancé", async () => {
    request.mockResolvedValue({
      accepted: true,
      message: PASSWORD_RESET_REQUEST_GENERIC_MESSAGE,
      retryAfter: 60,
    });
    const flow = makeFlow();
    flow.setEmail("a@b.com");
    await flow.requestCode(false);
    flow.setCodeFromRaw("12345678");
    expect(flow.getState().code).toBe("12345678");
    nowMs += 61_000;
    await flow.requestCode(true);
    expect(flow.getState().code).toBe("");
    expect(flow.getState().info).toMatch(/ancien peut ne plus être valable/);
    expect(flow.getState().cooldownEndsAt).toBe(nowMs + 60_000);
  });

  it("succès → sensibles vidés, bannière one-shot, replace /sign-in", async () => {
    confirm.mockResolvedValue({ success: true, message: "ok" });
    const flow = makeFlow();
    flow.setEmail("a@b.com");
    flow.setCodeFromRaw("12345678");
    flow.setPassword("secret1");
    flow.setConfirmPassword("secret1");
    await flow.confirmReset();
    const s = flow.getState();
    expect(s.email).toBe("");
    expect(s.code).toBe("");
    expect(s.password).toBe("");
    expect(s.confirmPassword).toBe("");
    expect(setPendingBanner).toHaveBeenCalledWith(
      PASSWORD_RESET_SUCCESS_LOGIN_BANNER
    );
    expect(replaceSignIn).toHaveBeenCalledTimes(1);
  });

  it("LoginPage consomme la bannière une seule fois", () => {
    setPendingLoginBanner(PASSWORD_RESET_SUCCESS_LOGIN_BANNER);
    expect(consumePendingLoginBanner()).toBe(
      PASSWORD_RESET_SUCCESS_LOGIN_BANNER
    );
    expect(consumePendingLoginBanner()).toBeNull();
  });

  it("BackHandler : confirm → request ; request → connexion", async () => {
    request.mockResolvedValue({
      accepted: true,
      message: PASSWORD_RESET_REQUEST_GENERIC_MESSAGE,
      retryAfter: 60,
    });
    const flow = makeFlow();
    flow.setEmail("a@b.com");
    await flow.requestCode(false);
    flow.setCodeFromRaw("99999999");
    flow.setPassword("x");
    flow.onBack();
    expect(flow.getState().step).toBe("request");
    expect(flow.getState().code).toBe("");
    expect(flow.getState().password).toBe("");
    flow.onBack();
    expect(replaceSignIn).toHaveBeenCalled();
  });

  it("erreur réseau request → rouge actionnable ; indéterminé → info neutre", async () => {
    const flow = makeFlow();
    flow.setEmail("a@b.com");
    request.mockRejectedValueOnce(
      new ApiClientError(0, "NETWORK_ERROR", "down")
    );
    await flow.requestCode(false);
    expect(flow.getState().error).toMatch(/injoignable/i);
    expect(flow.getState().step).toBe("request");

    request.mockRejectedValueOnce(
      new ApiClientError(500, "INTERNAL_ERROR", "boom-secret")
    );
    await flow.requestCode(false);
    expect(flow.getState().error).toBeNull();
    expect(flow.getState().info).toBe(PASSWORD_RESET_REQUEST_GENERIC_MESSAGE);
    expect(flow.getState().step).toBe("confirm");
  });

  it("confirm erreur générique sans fuite serveur", async () => {
    confirm.mockRejectedValue(
      new ApiClientError(401, "UNAUTHENTICATED", "code-leak-xyz")
    );
    const flow = makeFlow();
    flow.setEmail("a@b.com");
    flow.setCodeFromRaw("12345678");
    flow.setPassword("secret1");
    flow.setConfirmPassword("secret1");
    await flow.confirmReset();
    expect(flow.getState().error).toBe(PASSWORD_RESET_CONFIRM_GENERIC_ERROR);
    expect(flow.getState().error).not.toMatch(/leak/);
  });
});
