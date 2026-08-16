import { z } from "zod";

/**
 * Body POST /api/v1/auth/login — strict.
 */
export const MobileLoginBodySchema = z
  .object({
    email: z.string().email({ message: "Un email valide est requis" }),
    password: z.string().min(1, { message: "Un mot de passe est requis" }),
  })
  .strict();

/**
 * Body POST /api/v1/auth/refresh — strict.
 */
export const MobileRefreshBodySchema = z
  .object({
    refreshToken: z.string().min(1, { message: "refreshToken requis" }),
  })
  .strict();

/**
 * Body POST /api/v1/auth/logout — strict.
 * refreshToken recommandé ; access via Authorization Bearer.
 */
export const MobileLogoutBodySchema = z
  .object({
    refreshToken: z.string().min(1).optional(),
  })
  .strict();
