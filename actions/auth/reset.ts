"use server";

import { ResetSchema } from "@/schemas";
import * as z from "zod";
import { requestPasswordResetChallenge } from "@/lib/services/auth/password-reset-request";
import { PASSWORD_RESET_REQUEST_MESSAGE } from "@/lib/auth/password-reset-messages";
import { getPasswordResetClientIpFromAction } from "@/lib/auth/password-reset-client-ip";

/**
 * Demande web de réinitialisation — service partagé anti-énumération.
 *
 * @param values - { email }
 */
export const reset = async (values: z.infer<typeof ResetSchema>) => {
  const validatedFields = ResetSchema.safeParse(values);

  if (!validatedFields.success) {
    return { error: "Champs invalides !" };
  }

  try {
    const clientIp = await getPasswordResetClientIpFromAction();
    const result = await requestPasswordResetChallenge(
      validatedFields.data.email,
      { clientIp }
    );
    return { success: result.message || PASSWORD_RESET_REQUEST_MESSAGE };
  } catch {
    console.error("[password-reset] web_reset_action_failed", {
      category: "unexpected",
    });
    return { success: PASSWORD_RESET_REQUEST_MESSAGE };
  }
};
