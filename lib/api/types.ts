/**
 * Contrats JSON de l'API /api/v1 (couche HTTP uniquement).
 */

import type { ServiceErrorCode } from "@/lib/service-error";

export type ApiErrorBody = {
  code: ServiceErrorCode;
  message: string;
};

export type ApiSuccessResponse<T = unknown> = {
  success: true;
  data?: T;
};

export type ApiErrorResponse = {
  success: false;
  error: ApiErrorBody;
};

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;
