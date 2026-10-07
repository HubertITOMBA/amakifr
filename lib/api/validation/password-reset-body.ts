import { z } from "zod";
import { PASSWORD_RESET_PASSWORD_MIN_LENGTH } from "@/lib/auth/password-reset-constants";

/**
 * Body POST /api/v1/auth/password-reset/request — strict.
 */
export const PasswordResetRequestBodySchema = z
  .object({
    email: z.string().email({ message: "Un email valide est requis" }),
  })
  .strict();

/**
 * Body POST /api/v1/auth/password-reset/confirm — strict.
 * Politique MDP : min 6 (alignement projet) — trop faible, à renforcer plus tard.
 */
export const PasswordResetConfirmBodySchema = z
  .object({
    email: z.string().email({ message: "Un email valide est requis" }),
    code: z
      .string()
      .regex(/^\d{8}$/, {
        message: "Le code doit contenir exactement 8 chiffres",
      }),
    password: z.string().min(PASSWORD_RESET_PASSWORD_MIN_LENGTH, {
      message: `Le mot de passe doit contenir au moins ${PASSWORD_RESET_PASSWORD_MIN_LENGTH} caractères`,
    }),
    confirmPassword: z.string().min(1, {
      message: "La confirmation du mot de passe est requise",
    }),
  })
  .strict()
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });
