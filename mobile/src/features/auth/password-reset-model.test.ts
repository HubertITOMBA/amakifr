import { afterEach, describe, expect, it } from "vitest";
import { ApiClientError } from "@/api/types";
import {
  PASSWORD_RESET_CONFIRM_GENERIC_ERROR,
  PASSWORD_RESET_REQUEST_GENERIC_MESSAGE,
  PASSWORD_RESET_SUCCESS_LOGIN_BANNER,
  __resetPendingLoginBannerForTests,
  consumePendingLoginBanner,
  filterPasswordResetCodeDigits,
  isPlausiblePasswordResetEmail,
  mapPasswordResetApiError,
  nextStepAfterRequestAccepted,
  normalizePasswordResetEmail,
  passwordResetCooldownEndsAt,
  passwordResetCooldownRemaining,
  passwordResetResendLabel,
  setPendingLoginBanner,
  stepOnHardwareBack,
  validatePasswordResetConfirmClient,
} from "@/features/auth/password-reset-model";

describe("password-reset-model", () => {
  afterEach(() => {
    __resetPendingLoginBannerForTests();
  });

  it("normalise l’email", () => {
    expect(normalizePasswordResetEmail("  A@B.Com ")).toBe("a@b.com");
    expect(normalizePasswordResetEmail("")).toBe("");
    expect(isPlausiblePasswordResetEmail("a@b.com")).toBe(true);
    expect(isPlausiblePasswordResetEmail("pas-un-email")).toBe(false);
  });

  it("filtre le code 8 chiffres — conserve le zéro initial 01234567", () => {
    expect(filterPasswordResetCodeDigits("01234567")).toBe("01234567");
  });

  it("filtre le code 8 chiffres (collage / trop long / lettres)", () => {
    expect(filterPasswordResetCodeDigits("12 a34-5678")).toBe("12345678");
    expect(filterPasswordResetCodeDigits("123456789012")).toBe("12345678");
    expect(filterPasswordResetCodeDigits("abcdef")).toBe("");
    expect(filterPasswordResetCodeDigits("12ab34")).toBe("1234");
  });

  it("validation confirmation — MDP différents", () => {
    expect(
      validatePasswordResetConfirmClient({
        email: "a@b.com",
        code: "12345678",
        password: "secret1",
        confirmPassword: "secret2",
      })
    ).toBe("Les mots de passe ne correspondent pas");
  });

  it("validation confirmation — OK", () => {
    expect(
      validatePasswordResetConfirmClient({
        email: "a@b.com",
        code: "12 34-5678",
        password: "secret1",
        confirmPassword: "secret1",
      })
    ).toBeNull();
  });

  it("cooldown retryAfter", () => {
    const now = 1_000_000;
    const ends = passwordResetCooldownEndsAt(60, now);
    expect(passwordResetCooldownRemaining(ends, now)).toBe(60);
    expect(passwordResetCooldownRemaining(ends, now + 30_000)).toBe(30);
    expect(passwordResetCooldownRemaining(ends, now + 60_000)).toBe(0);
    expect(passwordResetResendLabel(12)).toMatch(/12s/);
    expect(passwordResetResendLabel(0)).toBe("Renvoyer le code");
  });

  it("transitions demande → confirmation ; back Android", () => {
    expect(nextStepAfterRequestAccepted()).toBe("confirm");
    expect(stepOnHardwareBack("confirm")).toBe("request");
    expect(stepOnHardwareBack("request")).toBe("exit");
  });

  it("mapping erreurs — générique confirm ; réseau", () => {
    expect(
      mapPasswordResetApiError(
        new ApiClientError(401, "UNAUTHENTICATED", "secret-leak"),
        "confirm"
      )
    ).toBe(PASSWORD_RESET_CONFIRM_GENERIC_ERROR);
    expect(
      mapPasswordResetApiError(
        new ApiClientError(0, "NETWORK_ERROR", "down"),
        "request"
      )
    ).toMatch(/injoignable/i);
    expect(
      mapPasswordResetApiError(
        new ApiClientError(400, "VALIDATION_ERROR", "Un email valide est requis"),
        "request"
      )
    ).toBe("Un email valide est requis");
  });

  it("bannière login volatile (pas d’URL)", () => {
    setPendingLoginBanner(PASSWORD_RESET_SUCCESS_LOGIN_BANNER);
    expect(consumePendingLoginBanner()).toBe(PASSWORD_RESET_SUCCESS_LOGIN_BANNER);
    expect(consumePendingLoginBanner()).toBeNull();
  });

  it("message demande anti-énumération fixe", () => {
    expect(PASSWORD_RESET_REQUEST_GENERIC_MESSAGE).toMatch(/Si un compte correspond/);
    expect(PASSWORD_RESET_REQUEST_GENERIC_MESSAGE).not.toMatch(/envoyé avec succès/i);
  });
});
