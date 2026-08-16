/** Contrat API /api/v1 (miroir minimal côté mobile). */

export type ApiErrorBody = {
  code: string;
  message: string;
};

export type ApiSuccessResponse<T> = {
  success: true;
  data?: T;
};

export type ApiErrorResponse = {
  success: false;
  error: ApiErrorBody;
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export type AuthUserDto = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
};

export type MobileAuthSessionDto = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  user: AuthUserDto;
};

export type MeDto = {
  id: string;
  name: string | null;
  email: string | null;
  image?: string | null;
  role: string;
  status: string;
  lastLogin?: string | null;
  createdAt?: string;
  updatedAt?: string;
  adherentId?: string | null;
};

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}
