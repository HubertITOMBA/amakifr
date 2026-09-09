import { z } from "zod";
import type { AuthContext } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import type {
  RegisterMyPushTokenInput,
  RegisterMyPushTokenResultDto,
} from "@/lib/services/push/types";

const EXPO_PUSH_TOKEN_RE =
  /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/;

const RegisterSchema = z.object({
  token: z
    .string()
    .trim()
    .min(20, "Token push invalide")
    .max(200, "Token push invalide")
    .refine((t) => EXPO_PUSH_TOKEN_RE.test(t), "Format de token Expo invalide"),
  platform: z.enum(["android", "ios"], {
    errorMap: () => ({ message: "Plateforme non supportée" }),
  }),
  deviceName: z
    .string()
    .trim()
    .max(120, "Nom d'appareil trop long")
    .optional()
    .nullable(),
});

/**
 * Enregistre / rattache un token Expo Push à l'acteur courant (upsert).
 * Si le token appartenait à un autre user (même appareil), il est réattaché.
 *
 * @param actor - Contexte auth (Bearer / session)
 * @param input - token, platform, deviceName optionnel
 */
export async function registerMyPushToken(
  actor: AuthContext,
  input: RegisterMyPushTokenInput
): Promise<RegisterMyPushTokenResultDto> {
  if (!actor.userId) {
    throw new ServiceError("UNAUTHENTICATED", "Non authentifié");
  }

  const parsed = RegisterSchema.safeParse(input);
  if (!parsed.success) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      parsed.error.errors[0]?.message || "Données token invalides"
    );
  }

  const now = new Date();
  const deviceName = parsed.data.deviceName?.trim() || null;

  const row = await db.mobilePushToken.upsert({
    where: { token: parsed.data.token },
    create: {
      userId: actor.userId,
      token: parsed.data.token,
      platform: parsed.data.platform,
      deviceName,
      lastSeenAt: now,
      disabledAt: null,
    },
    update: {
      userId: actor.userId,
      platform: parsed.data.platform,
      deviceName,
      lastSeenAt: now,
      disabledAt: null,
    },
  });

  return {
    id: row.id,
    token: row.token,
    platform: row.platform,
    lastSeenAt: row.lastSeenAt.toISOString(),
  };
}
