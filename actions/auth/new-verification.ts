"use server"

import * as z from "zod"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { EmailVerificationSchema } from "@/schemas"
import { normalizeEmail } from "@/lib/utils"
import {
  VERIFICATION_MAX_FAILED_ATTEMPTS,
  verificationCodesEqual,
} from "@/lib/token"

/** Message unique — aucune énumération (token/utilisateur/expiration/verrou). */
export const EMAIL_VERIFICATION_GENERIC_ERROR =
  "Code invalide, expiré ou indisponible. Demandez un nouveau code."

const VERIFICATION_TX_MAX_ATTEMPTS = 3

type NewVerificationResult =
  | { success: string }
  | { error: string }

function isConcurrencyError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" || error.code === "P2002")
  )
}

/**
 * Confirme l'adresse e-mail d'inscription via email + code.
 * Lookup lié à l'email (jamais par code seul). Plafond persistant de 3 erreurs.
 * Ne modifie jamais le status utilisateur (Inactif reste distinct).
 * Ne journalise jamais email/code/token.
 *
 * @param values - { email, code }
 */
export async function newVerification(
  values: z.infer<typeof EmailVerificationSchema>,
): Promise<NewVerificationResult> {
  const parsed = EmailVerificationSchema.safeParse(values)
  if (!parsed.success) {
    return { error: EMAIL_VERIFICATION_GENERIC_ERROR }
  }

  const normalizedEmail = normalizeEmail(parsed.data.email)
  const providedCode = parsed.data.code

  for (let attempt = 1; attempt <= VERIFICATION_TX_MAX_ATTEMPTS; attempt++) {
    try {
      const outcome = await db.$transaction(
        async (tx) => {
          const existingToken = await tx.verificationToken.findUnique({
            where: { email: normalizedEmail },
          })

          if (!existingToken) {
            return { kind: "reject" as const }
          }

          const now = new Date()
          const expired = now > new Date(existingToken.expires)
          const locked =
            existingToken.lockedAt != null ||
            existingToken.failedAttempts >= VERIFICATION_MAX_FAILED_ATTEMPTS

          if (expired || locked) {
            return { kind: "reject" as const }
          }

          const codeMatches = verificationCodesEqual(
            providedCode,
            existingToken.token,
          )

          if (!codeMatches) {
            const nextAttempts = existingToken.failedAttempts + 1
            const shouldLock = nextAttempts >= VERIFICATION_MAX_FAILED_ATTEMPTS
            await tx.verificationToken.update({
              where: { email: normalizedEmail },
              data: {
                failedAttempts: nextAttempts,
                lockedAt: shouldLock ? now : existingToken.lockedAt,
              },
            })
            return { kind: "reject" as const }
          }

          const existingUser = await tx.user.findUnique({
            where: { email: normalizedEmail },
          })

          if (!existingUser) {
            return { kind: "reject" as const }
          }

          await tx.user.update({
            where: { email: normalizedEmail },
            data: {
              emailVerified: now,
            },
          })

          await tx.verificationToken.delete({
            where: { id: existingToken.id },
          })

          return { kind: "ok" as const }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )

      if (outcome.kind === "ok") {
        return { success: "Email vérifié !" }
      }
      return { error: EMAIL_VERIFICATION_GENERIC_ERROR }
    } catch (error) {
      if (isConcurrencyError(error) && attempt < VERIFICATION_TX_MAX_ATTEMPTS) {
        continue
      }
      console.error("[newVerification]", { category: "exception" })
      return { error: EMAIL_VERIFICATION_GENERIC_ERROR }
    }
  }

  return { error: EMAIL_VERIFICATION_GENERIC_ERROR }
}
