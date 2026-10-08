/**
 * Preuves UI M1 — comportemental via harness (= même contrôleur que l’écran)
 * + garde source complémentaire (maxLength absent, pas de console sensible).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/api/types";
import {
  createForgotPasswordFlow,
  navigateToForgotPassword,
} from "@/features/auth/password-reset-flow";
import {
  PASSWORD_RESET_REQUEST_GENERIC_MESSAGE,
  PASSWORD_RESET_SUCCESS_LOGIN_BANNER,
  __resetPendingLoginBannerForTests,
  consumePendingLoginBanner,
  passwordResetEmailPreview,
  passwordResetUsedAddressLine,
  setPendingLoginBanner,
} from "@/features/auth/password-reset-model";
import { MOBILE_FORGOT_PASSWORD_ROUTE } from "@/features/auth/sign-in-model";

const srcDir = dirname(fileURLToPath(import.meta.url));
const appDir = join(srcDir, "../../app");

/**
 * Harness branché comme ForgotPasswordScreen : handlers publics
 * (request / resend / confirm / back / collage code / yeux).
 */
function createScreenHarness() {
  const request = vi.fn();
  const confirm = vi.fn();
  const replaceSignIn = vi.fn();
  const push = vi.fn();
  const setPendingBanner = vi.fn((msg: string) => setPendingLoginBanner(msg));
  let nowMs = 1_000_000;

  const flow = createForgotPasswordFlow({
    api: { request, confirm },
    nav: { replaceSignIn },
    setPendingBanner,
    now: () => nowMs,
  });

  return {
    request,
    confirm,
    replaceSignIn,
    push,
    setPendingBanner,
    advanceMs: (ms: number) => {
      nowMs += ms;
    },
    // Handlers équivalents écran
    onForgotLinkFromLogin: () => {
      navigateToForgotPassword(push, MOBILE_FORGOT_PASSWORD_ROUTE);
    },
    onChangeEmail: (t: string) => flow.setEmail(t),
    onChangeCode: (t: string) => flow.setCodeFromRaw(t),
    onChangePassword: (t: string) => flow.setPassword(t),
    onChangeConfirm: (t: string) => flow.setConfirmPassword(t),
    onTogglePasswordEye: () => flow.togglePasswordVisible(),
    onToggleConfirmEye: () => flow.toggleConfirmVisible(),
    onPressRequest: () => flow.requestCode(false),
    onPressResend: () => flow.requestCode(true),
    onPressConfirm: () => flow.confirmReset(),
    onPressEditAddress: () => flow.editAddress(),
    onEndEditingEmail: (text: string) => flow.setEmail(text),
    onHardwareBack: () => flow.onBack(),
    onHeaderBack: () => flow.onBack(),
    getState: () => flow.getState(),
    isBusy: () => flow.isBusy(),
    previewLine: () => {
      const p = passwordResetEmailPreview(flow.getState().email);
      return p ? passwordResetUsedAddressLine(p) : null;
    },
    confirmAddressLine: () => {
      const s = flow.getState().submittedEmail;
      return s ? passwordResetUsedAddressLine(s) : null;
    },
  };
}

describe("ForgotPasswordScreen harness — comportemental", () => {
  let h: ReturnType<typeof createScreenHarness>;

  beforeEach(() => {
    __resetPendingLoginBannerForTests();
    h = createScreenHarness();
  });

  afterEach(() => {
    __resetPendingLoginBannerForTests();
  });

  it("clic LoginPage → navigation /forgot-password", () => {
    h.onForgotLinkFromLogin();
    expect(h.push).toHaveBeenCalledWith("/forgot-password");
    expect(h.push.mock.calls[0]).toHaveLength(1);
    expect(String(h.push.mock.calls[0][0])).not.toMatch(/[?&]/);
    expect(String(h.push.mock.calls[0][0])).not.toMatch(/@/);
  });

  it("demande valide → request exact + étape confirmation + message générique", async () => {
    h.request.mockResolvedValue({
      accepted: true,
      message: PASSWORD_RESET_REQUEST_GENERIC_MESSAGE,
      retryAfter: 60,
    });
    h.onChangeEmail("  A@B.com ");
    expect(h.previewLine()).toBe("Adresse utilisée : a@b.com");
    await h.onPressRequest();
    expect(h.request).toHaveBeenCalledWith("a@b.com");
    expect(h.getState().step).toBe("confirm");
    expect(h.getState().info).toBe(PASSWORD_RESET_REQUEST_GENERIC_MESSAGE);
    expect(h.getState().error).toBeNull();
    expect(h.getState().submittedEmail).toBe("a@b.com");
    expect(h.confirmAddressLine()).toBe("Adresse utilisée : a@b.com");
  });

  it("onEndEditing synchronise le contrôleur", () => {
    h.onChangeEmail("old@x.com");
    h.onEndEditingEmail("  New@Y.COM ");
    expect(h.getState().email).toBe("  New@Y.COM ");
    expect(h.previewLine()).toBe("Adresse utilisée : new@y.com");
  });

  it("preview = payload exact (majuscules/espaces)", async () => {
    h.request.mockResolvedValue({
      accepted: true,
      message: PASSWORD_RESET_REQUEST_GENERIC_MESSAGE,
      retryAfter: 60,
    });
    h.onChangeEmail("  M1.Reset@Example.INVALID ");
    const preview = h.previewLine();
    expect(preview).toBe("Adresse utilisée : m1.reset@example.invalid");
    await h.onPressRequest();
    expect(h.request).toHaveBeenCalledWith("m1.reset@example.invalid");
    expect(h.confirmAddressLine()).toBe(preview);
  });

  it("régression synthétique exact dans payload", async () => {
    h.request.mockResolvedValue({
      accepted: true,
      message: PASSWORD_RESET_REQUEST_GENERIC_MESSAGE,
      retryAfter: 60,
    });
    h.onChangeEmail("m1.reset@example.invalid");
    await h.onPressRequest();
    expect(h.request).toHaveBeenCalledWith("m1.reset@example.invalid");
  });

  it("Modifier l’adresse → request sans API", async () => {
    h.request.mockResolvedValue({
      accepted: true,
      message: PASSWORD_RESET_REQUEST_GENERIC_MESSAGE,
      retryAfter: 60,
    });
    h.onChangeEmail("a@b.com");
    await h.onPressRequest();
    h.onChangeCode("12345678");
    const n = h.request.mock.calls.length;
    h.onPressEditAddress();
    expect(h.request).toHaveBeenCalledTimes(n);
    expect(h.getState().step).toBe("request");
    expect(h.getState().email).toBe("a@b.com");
    expect(h.getState().code).toBe("");
  });

  it("resend ignore email champ divergent ; utilise submittedEmail", async () => {
    h.request.mockResolvedValue({
      accepted: true,
      message: PASSWORD_RESET_REQUEST_GENERIC_MESSAGE,
      retryAfter: 60,
    });
    h.onChangeEmail("kept@amaki.fr");
    await h.onPressRequest();
    h.onChangeEmail("visual@elsewhere.test");
    h.advanceMs(61_000);
    await h.onPressResend();
    expect(h.request).toHaveBeenLastCalledWith("kept@amaki.fr");
  });

  it("collage code filtré sur le handler champ (pas de maxLength)", () => {
    h.onChangeCode("12 a34-5678");
    expect(h.getState().code).toBe("12345678");
    h.onChangeCode("1234567890");
    expect(h.getState().code).toBe("12345678");
    h.onChangeCode("ab xx");
    expect(h.getState().code).toBe("");
  });

  it("deux yeux indépendants ; valeurs conservées", () => {
    h.onChangePassword("alpha");
    h.onChangeConfirm("beta");
    h.onTogglePasswordEye();
    expect(h.getState().passwordVisible).toBe(true);
    expect(h.getState().confirmVisible).toBe(false);
    expect(h.getState().password).toBe("alpha");
    expect(h.getState().confirmPassword).toBe("beta");
    h.onToggleConfirmEye();
    expect(h.getState().confirmVisible).toBe(true);
    expect(h.getState().password).toBe("alpha");
  });

  it("confirm MDP différents → API non appelée", async () => {
    h.onChangeEmail("a@b.com");
    h.onChangeCode("12345678");
    h.onChangePassword("secret1");
    h.onChangeConfirm("secret2");
    await h.onPressConfirm();
    expect(h.confirm).not.toHaveBeenCalled();
  });

  it("confirm valide → payload exact", async () => {
    h.confirm.mockResolvedValue({ success: true, message: "ok" });
    h.onChangeEmail("A@B.com");
    h.onChangeCode("12345678");
    h.onChangePassword("secret1");
    h.onChangeConfirm("secret1");
    await h.onPressConfirm();
    expect(h.confirm).toHaveBeenCalledWith({
      email: "a@b.com",
      code: "12345678",
      password: "secret1",
      confirmPassword: "secret1",
    });
  });

  it("double clic request/confirm/resend → un seul appel en vol", async () => {
    let resolveReq!: (v: unknown) => void;
    h.request.mockImplementation(
      () =>
        new Promise((r) => {
          resolveReq = r;
        })
    );
    h.onChangeEmail("a@b.com");
    const a = h.onPressRequest();
    const b = h.onPressRequest();
    expect(h.request).toHaveBeenCalledTimes(1);
    expect(h.isBusy()).toBe(true);
    resolveReq!({
      accepted: true,
      message: PASSWORD_RESET_REQUEST_GENERIC_MESSAGE,
      retryAfter: 45,
    });
    await a;
    await b;
    expect(h.isBusy()).toBe(false);

    h.advanceMs(46_000);
    let resolveResend!: (v: unknown) => void;
    h.request.mockImplementation(
      () =>
        new Promise((r) => {
          resolveResend = r;
        })
    );
    const r1 = h.onPressResend();
    const r2 = h.onPressResend();
    expect(h.request).toHaveBeenCalledTimes(2);
    resolveResend!({
      accepted: true,
      message: PASSWORD_RESET_REQUEST_GENERIC_MESSAGE,
      retryAfter: 45,
    });
    await r1;
    await r2;

    h.onChangeCode("11111111");
    h.onChangePassword("secret1");
    h.onChangeConfirm("secret1");
    let resolveConf!: (v: unknown) => void;
    h.confirm.mockImplementation(
      () =>
        new Promise((r) => {
          resolveConf = r;
        })
    );
    const c1 = h.onPressConfirm();
    const c2 = h.onPressConfirm();
    expect(h.confirm).toHaveBeenCalledTimes(1);
    resolveConf!({ success: true, message: "ok" });
    await c1;
    await c2;
  });

  it("renvoi accepté → code vidé + cooldown", async () => {
    h.request.mockResolvedValue({
      accepted: true,
      message: PASSWORD_RESET_REQUEST_GENERIC_MESSAGE,
      retryAfter: 60,
    });
    h.onChangeEmail("a@b.com");
    await h.onPressRequest();
    h.onChangeCode("12345678");
    h.advanceMs(61_000);
    await h.onPressResend();
    expect(h.getState().code).toBe("");
    expect(h.getState().info).toMatch(/ancien/);
  });

  it("succès → nettoyage, pont one-shot, replace sign-in", async () => {
    h.confirm.mockResolvedValue({ success: true, message: "ok" });
    h.onChangeEmail("a@b.com");
    h.onChangeCode("12345678");
    h.onChangePassword("secret1");
    h.onChangeConfirm("secret1");
    await h.onPressConfirm();
    expect(h.getState().email).toBe("");
    expect(h.getState().code).toBe("");
    expect(h.getState().password).toBe("");
    expect(h.replaceSignIn).toHaveBeenCalled();
    expect(h.setPendingBanner).toHaveBeenCalledWith(
      PASSWORD_RESET_SUCCESS_LOGIN_BANNER
    );
    expect(consumePendingLoginBanner()).toBe(
      PASSWORD_RESET_SUCCESS_LOGIN_BANNER
    );
    expect(consumePendingLoginBanner()).toBeNull();
  });

  it("BackHandler / retour : confirm→demande ; demande→connexion", async () => {
    h.request.mockResolvedValue({
      accepted: true,
      message: PASSWORD_RESET_REQUEST_GENERIC_MESSAGE,
      retryAfter: 60,
    });
    h.onChangeEmail("a@b.com");
    await h.onPressRequest();
    h.onHardwareBack();
    expect(h.getState().step).toBe("request");
    h.onHeaderBack();
    expect(h.replaceSignIn).toHaveBeenCalled();
  });

  it("erreur réseau actionnable en rouge ; pas de console avec secrets", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    h.request.mockRejectedValue(
      new ApiClientError(0, "NETWORK_ERROR", "down")
    );
    h.onChangeEmail("secret@user.fr");
    await h.onPressRequest();
    expect(h.getState().error).toMatch(/injoignable/i);
    for (const spy of [logSpy, warnSpy, errSpy]) {
      for (const call of spy.mock.calls) {
        const flat = call.map(String).join(" ");
        expect(flat).not.toMatch(/secret@user\.fr/);
        expect(flat).not.toMatch(/12345678/);
        expect(flat).not.toMatch(/password/i);
      }
    }
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errSpy.mockRestore();
  });
});

describe("garde source complémentaire (non principale)", () => {
  it("forgot-password : maxLength absent ; filtre contrôlé ; inputMode numeric", () => {
    const src = readFileSync(join(appDir, "forgot-password.tsx"), "utf8");
    expect(src).not.toMatch(/\bmaxLength\s*=/);
    expect(src).toMatch(/setCodeFromRaw|filterPasswordResetCodeDigits/);
    expect(src).toMatch(/inputMode="numeric"/);
    expect(src).toMatch(/autoComplete="one-time-code"/);
    expect(src).toMatch(/useForgotPasswordFlow/);
  });

  it("forgot-password : autofill email désactivé + onEndEditing sync", () => {
    const src = readFileSync(join(appDir, "forgot-password.tsx"), "utf8");
    expect(src).toMatch(/autoComplete:\s*"off"|autoComplete="off"/);
    expect(src).toMatch(/importantForAutofill:\s*"no"/);
    expect(src).toMatch(/textContentType:\s*"none"|textContentType="none"/);
    expect(src).toMatch(/onEndEditing/);
    expect(src).toMatch(/nativeEvent\.text/);
    expect(src).not.toMatch(/autoComplete="email"/);
    expect(src).toMatch(/passwordResetUsedAddressLine/);
    expect(src).toMatch(/editAddress/);
    // Pas de log diagnostique d’adresse
    expect(src).not.toMatch(/console\.(log|debug|info|warn).*email/i);
  });

  it("sign-in : navigateToForgotPassword sans query secrets", () => {
    const src = readFileSync(join(appDir, "sign-in.tsx"), "utf8");
    expect(src).toMatch(/navigateToForgotPassword/);
    expect(src).toMatch(/consumePendingLoginBanner/);
    expect(src).not.toMatch(/forgot-password\?/);
  });
});
