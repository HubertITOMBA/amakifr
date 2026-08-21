import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import { declareBankOrWeroPayment } from "@/lib/services/paiements/declare-bank-wero-payment";

export const dynamic = "force-dynamic";

const FORBIDDEN_BODY_KEYS = [
  "userId",
  "adherentId",
  "memberId",
  "ownerId",
  "status",
  "statut",
  "force",
  "override",
] as const;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Stocke un justificatif hors public/ (servi via auth ultérieure).
 * Chemin relatif stocké en base : private/justificatifs-paiements/...
 */
async function storePrivateJustificatif(
  file: File,
  userId: string
): Promise<string> {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      "Format de justificatif non autorisé (PDF ou image)"
    );
  }
  if (file.size > MAX_BYTES) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      "Justificatif trop volumineux (max 10 Mo)"
    );
  }

  const ext =
    file.type === "application/pdf"
      ? "pdf"
      : file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : file.type === "image/gif"
            ? "gif"
            : "jpg";

  const dir = path.join(
    process.cwd(),
    "storage",
    "justificatifs-paiements"
  );
  await mkdir(dir, { recursive: true });
  const filename = `decl_${Date.now()}_${userId.slice(0, 8)}_${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;
  const full = path.join(dir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(full, buffer);
  return `private/justificatifs-paiements/${filename}`;
}

/**
 * POST /api/v1/me/payments/bank-transfer
 * multipart: targetType, targetId, amount, paymentMethod, justificatif (file)
 * ou JSON + justificatifChemin (chemin déjà uploadé Web).
 */
export async function POST(request: NextRequest) {
  try {
    // Diagnostic temporaire : confirme si la requête atteint le serveur (A54).
    // eslint-disable-next-line no-console
    console.log(
      "[PAYMENT_API] request received",
      request.headers.get("content-type") ?? "(no content-type)"
    );

    const actor = await resolveApiActor(request);
    if (!actor) {
      return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    }

    const contentType = request.headers.get("content-type") ?? "";
    let payload: Record<string, unknown> = {};

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      for (const key of FORBIDDEN_BODY_KEYS) {
        if (form.has(key)) {
          throw new ServiceError(
            "VALIDATION_ERROR",
            `Champ ${key} non autorisé`
          );
        }
      }
      const file = form.get("justificatif");
      if (!(file instanceof File) || file.size === 0) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          "Justificatif obligatoire"
        );
      }
      const chemin = await storePrivateJustificatif(file, actor.userId);
      payload = {
        targetType: String(form.get("targetType") ?? ""),
        targetId: String(form.get("targetId") ?? ""),
        amount: String(form.get("amount") ?? ""),
        paymentMethod: String(form.get("paymentMethod") ?? ""),
        justificatifChemin: chemin,
      };
    } else {
      const body = (await request.json()) as Record<string, unknown>;
      for (const key of FORBIDDEN_BODY_KEYS) {
        if (key in body) {
          throw new ServiceError(
            "VALIDATION_ERROR",
            `Champ ${key} non autorisé`
          );
        }
      }
      payload = body;
    }

    const data = await declareBankOrWeroPayment(actor, payload);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
