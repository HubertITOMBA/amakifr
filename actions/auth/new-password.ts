"use server";

import { NewPasswordSchema } from "@/schemas";
import * as z from "zod";
import { confirmPasswordResetChallenge } from "@/lib/services/auth/password-reset-confirm";
import { PASSWORD_RESET_CONFIRM_GENERIC_ERROR } from "@/lib/auth/password-reset-messages";
import { isServiceError } from "@/lib/service-error";
import { getPasswordResetClientIpFromAction } from "@/lib/auth/password-reset-client-ip";

/**
 * Confirmation web — même service que POST /api/v1/auth/password-reset/confirm.
 *
 * @param values - email + code 8 chiffres + password + confirmPassword
 */
export const newPassword = async (
  values: z.infer<typeof NewPasswordSchema>
) => {
  const validatedFields = NewPasswordSchema.safeParse(values);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.errors[0]?.message || "Champs non valides !",
    };
  }

  try {
    const clientIp = await getPasswordResetClientIpFromAction();
    const result = await confirmPasswordResetChallenge({
      ...validatedFields.data,
      clientIp,
    });
    return { success: result.message };
  } catch (error) {
    if (isServiceError(error)) {
      return { error: error.message };
    }
    console.error("[password-reset] web_confirm_failed", {
      category: "unexpected",
    });
    return { error: PASSWORD_RESET_CONFIRM_GENERIC_ERROR };
  }
};
