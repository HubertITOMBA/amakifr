import { describe, expect, it } from "vitest";
import {
  getPasswordResetConfirmPath,
  PASSWORD_RESET_NEW_PASSWORD_PATH,
  shouldNavigateAfterResetRequest,
} from "@/components/auth/reset-form-navigation";
import { PASSWORD_RESET_REQUEST_MESSAGE } from "@/lib/auth/password-reset-messages";

describe("reset-form-navigation", () => {
  it("navigue uniquement sur succès (message anti-énumération)", () => {
    expect(
      shouldNavigateAfterResetRequest({
        success: PASSWORD_RESET_REQUEST_MESSAGE,
      })
    ).toBe(true);
  });

  it("ne navigue pas sur erreur actionnable", () => {
    expect(
      shouldNavigateAfterResetRequest({ error: "Champs invalides !" })
    ).toBe(false);
    expect(
      shouldNavigateAfterResetRequest({
        error: "Champs invalides !",
        success: PASSWORD_RESET_REQUEST_MESSAGE,
      })
    ).toBe(false);
  });

  it("refuse réponse vide / null", () => {
    expect(shouldNavigateAfterResetRequest(undefined)).toBe(false);
    expect(shouldNavigateAfterResetRequest({})).toBe(false);
    expect(shouldNavigateAfterResetRequest({ success: "   " })).toBe(false);
  });

  it("chemin confirm sans query params", () => {
    expect(getPasswordResetConfirmPath()).toBe(
      PASSWORD_RESET_NEW_PASSWORD_PATH
    );
    expect(getPasswordResetConfirmPath()).toBe("/auth/new-password");
    expect(getPasswordResetConfirmPath()).not.toMatch(/[?=&#]/);
  });
});
