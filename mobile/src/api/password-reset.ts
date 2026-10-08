/**
 * Client API password-reset mobile — sans Bearer (endpoints publics).
 * Utilise EXPO_PUBLIC_API_URL via session.apiRequest.
 */

import { apiRequest } from "@/auth/session";
import { buildApiUrl } from "@/config/api";
import { normalizePasswordResetEmail } from "@/features/auth/password-reset-model";

export const PASSWORD_RESET_REQUEST_PATH =
  "/api/v1/auth/password-reset/request";
export const PASSWORD_RESET_CONFIRM_PATH =
  "/api/v1/auth/password-reset/confirm";

export type PasswordResetRequestAccepted = {
  accepted: true;
  message: string;
  retryAfter: number;
};

export type PasswordResetConfirmSuccess = {
  success: true;
  message: string;
};

/**
 * URL absolue de demande (tests / debug sans secret).
 */
export function passwordResetRequestUrl(): string {
  return buildApiUrl(PASSWORD_RESET_REQUEST_PATH);
}

/**
 * URL absolue de confirmation.
 */
export function passwordResetConfirmUrl(): string {
  return buildApiUrl(PASSWORD_RESET_CONFIRM_PATH);
}

/**
 * POST demande de code — pas d’Authorization.
 *
 * @param email - E-mail brut (normalisé ici)
 */
export async function requestPasswordReset(
  email: string
): Promise<PasswordResetRequestAccepted> {
  const normalized = normalizePasswordResetEmail(email);
  return apiRequest<PasswordResetRequestAccepted>(PASSWORD_RESET_REQUEST_PATH, {
    method: "POST",
    body: { email: normalized },
    skipAuthRetry: true,
    accessToken: null,
  });
}

/**
 * POST confirmation — pas d’Authorization.
 */
export async function confirmPasswordReset(input: {
  email: string;
  code: string;
  password: string;
  confirmPassword: string;
}): Promise<PasswordResetConfirmSuccess> {
  return apiRequest<PasswordResetConfirmSuccess>(PASSWORD_RESET_CONFIRM_PATH, {
    method: "POST",
    body: {
      email: normalizePasswordResetEmail(input.email),
      code: input.code,
      password: input.password,
      confirmPassword: input.confirmPassword,
    },
    skipAuthRetry: true,
    accessToken: null,
  });
}
