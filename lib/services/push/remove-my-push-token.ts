import { z } from "zod";
import type { AuthContext } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import type {
  RemoveMyPushTokenInput,
  RemoveMyPushTokenResultDto,
} from "@/lib/services/push/types";

const RemoveSchema = z.object({
  token: z.string().trim().min(1, "Token requis").max(200),
});

/**
 * Détache le token Expo Push de l'acteur courant uniquement.
 * Ne touche jamais un token appartenant à un autre user.
 *
 * @param actor - Contexte auth
 * @param input - token exact de l'installation
 */
export async function removeMyPushToken(
  actor: AuthContext,
  input: RemoveMyPushTokenInput
): Promise<RemoveMyPushTokenResultDto> {
  if (!actor.userId) {
    throw new ServiceError("UNAUTHENTICATED", "Non authentifié");
  }

  const parsed = RemoveSchema.safeParse(input);
  if (!parsed.success) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      parsed.error.errors[0]?.message || "Token invalide"
    );
  }

  const result = await db.mobilePushToken.deleteMany({
    where: {
      token: parsed.data.token,
      userId: actor.userId,
    },
  });

  return { removed: result.count > 0 };
}
