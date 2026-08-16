import { NextResponse } from "next/server";
import type { ApiErrorBody, ApiSuccessResponse } from "@/lib/api/types";

/** Headers par défaut pour les ressources personnelles /api/v1/me/* */
const PRIVATE_NO_STORE = {
  "Cache-Control": "private, no-store",
} as const;

/**
 * Réponse JSON de succès pour /api/v1.
 *
 * @param data - Payload optionnel (omis si undefined)
 * @param status - Code HTTP (défaut 200)
 */
export function apiSuccess<T>(
  data?: T,
  status = 200
): NextResponse<ApiSuccessResponse<T>> {
  const body: ApiSuccessResponse<T> =
    data === undefined ? { success: true } : { success: true, data };

  return NextResponse.json(body, {
    status,
    headers: PRIVATE_NO_STORE,
  });
}

/**
 * Réponse JSON d'erreur pour /api/v1 (sans stack / détails internes).
 *
 * @param code - Code d'erreur stable
 * @param message - Message utilisateur
 * @param status - Code HTTP
 */
export function apiError(
  code: ApiErrorBody["code"],
  message: string,
  status: number
): NextResponse<{ success: false; error: ApiErrorBody }> {
  return NextResponse.json(
    {
      success: false as const,
      error: { code, message },
    },
    {
      status,
      headers: PRIVATE_NO_STORE,
    }
  );
}
