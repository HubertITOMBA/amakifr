import { z } from "zod";
import { TypeNotification } from "@prisma/client";
import type { GetMyNotificationsOptions } from "@/lib/services/notifications/types";
import { ServiceError } from "@/lib/service-error";

/**
 * Query params GET /api/v1/me/notifications.
 * limit défaut service = 50 ; plafond API = 100.
 */
export const MeNotificationsQuerySchema = z.object({
  lue: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  type: z.nativeEnum(TypeNotification).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

/**
 * Parse et valide les searchParams notifications.
 *
 * @throws {ServiceError} VALIDATION_ERROR
 */
export function parseMeNotificationsQuery(
  searchParams: URLSearchParams
): GetMyNotificationsOptions {
  const raw = {
    lue: searchParams.get("lue") ?? undefined,
    type: searchParams.get("type") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    offset: searchParams.get("offset") ?? undefined,
  };

  // Rejeter explicitement les IDs client (anti-IDOR)
  if (searchParams.has("userId") || searchParams.has("adherentId")) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      "Paramètres userId et adherentId non autorisés"
    );
  }

  const parsed = MeNotificationsQuerySchema.safeParse(raw);
  if (!parsed.success) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      parsed.error.errors[0]?.message || "Paramètres de requête invalides"
    );
  }

  const options: GetMyNotificationsOptions = {};
  if (parsed.data.lue !== undefined) options.lue = parsed.data.lue;
  if (parsed.data.type !== undefined) options.type = parsed.data.type;
  if (parsed.data.limit !== undefined) options.limit = parsed.data.limit;
  if (parsed.data.offset !== undefined) options.offset = parsed.data.offset;
  return options;
}
