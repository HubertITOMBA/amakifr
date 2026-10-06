import { getPasswordResetTokenByEmail } from "@/actions/auth"
import { db } from "./db"
import { randomInt, timingSafeEqual } from "node:crypto"
import { Prisma } from "@prisma/client"

import { v4 as uuidv4 } from "uuid"

/**
 * Durée de validité du token de vérification email (ms).
 * Valeur réelle actuelle du code : 5 minutes (5 * 60 * 1000).
 * Réservée à la vérification email — ne pas réutiliser pour le reset mot de passe.
 */
export const VERIFICATION_TOKEN_TTL_MS = 5 * 60 * 1000

/**
 * Durée de validité du token de réinitialisation de mot de passe (ms).
 * Même valeur historique que précédemment (5 minutes) — constante distincte.
 */
export const PASSWORD_RESET_TOKEN_TTL_MS = 5 * 60 * 1000

/**
 * Délai minimum côté serveur entre deux envois de code de vérification (ms).
 */
export const VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000

/** Plafond persistant de tentatives incorrectes avant verrouillage. */
export const VERIFICATION_MAX_FAILED_ATTEMPTS = 3

/** Nombre max de reprises sur conflit de concurrence Prisma (P2034 / P2002). */
const VERIFICATION_TOKEN_TX_MAX_ATTEMPTS = 3

export type GenerateVerificationMode = "initial" | "resend"

export type GenerateVerificationTokenResult =
  | {
      status: "created"
      token: {
        id: string
        email: string
        token: string
        expires: Date
        createdAt: Date
        failedAttempts: number
        lockedAt: Date | null
      }
    }
  | { status: "cooldown" }

/**
 * Compare deux codes de façon résistante au timing (même longueur attendue).
 *
 * @param provided - Code fourni par l'utilisateur
 * @param expected - Code stocké
 */
export function verificationCodesEqual(
  provided: string,
  expected: string,
): boolean {
  try {
    const a = Buffer.from(provided, "utf8")
    const b = Buffer.from(expected, "utf8")
    if (a.length !== b.length) {
      return false
    }
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

function isConcurrencyError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" || error.code === "P2002")
  )
}

function buildSixDigitCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0")
}

/**
 * Génère ou régénère un VerificationToken de façon atomique (Serializable).
 * Un seul token actif par email (contrainte UNIQUE).
 * Mode initial : remplace toujours et remet failedAttempts/lockedAt à zéro.
 * Mode resend : refuse si createdAt < 60 s (cooldown).
 * Ne jamais logger le code ni l'email.
 *
 * @param email - Email déjà normalisé (minuscules)
 * @param mode - "initial" (inscription) ou "resend" (renvoi avec cooldown)
 */
export async function generateVerificationToken(
  email: string,
  mode: GenerateVerificationMode = "initial",
): Promise<GenerateVerificationTokenResult> {
  for (let attempt = 1; attempt <= VERIFICATION_TOKEN_TX_MAX_ATTEMPTS; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          const existing = await tx.verificationToken.findUnique({
            where: { email },
          })

          if (mode === "resend" && existing) {
            const ageMs = Date.now() - new Date(existing.createdAt).getTime()
            if (ageMs >= 0 && ageMs < VERIFICATION_RESEND_COOLDOWN_MS) {
              return { status: "cooldown" as const }
            }
          }

          const sixDigitCode = buildSixDigitCode()
          const now = new Date()
          const expires = new Date(now.getTime() + VERIFICATION_TOKEN_TTL_MS)

          if (existing) {
            const updated = await tx.verificationToken.update({
              where: { email },
              data: {
                token: sixDigitCode,
                expires,
                createdAt: now,
                failedAttempts: 0,
                lockedAt: null,
              },
            })
            return { status: "created" as const, token: updated }
          }

          const created = await tx.verificationToken.create({
            data: {
              email,
              token: sixDigitCode,
              expires,
              createdAt: now,
              failedAttempts: 0,
              lockedAt: null,
            },
          })
          return { status: "created" as const, token: created }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
    } catch (error) {
      if (isConcurrencyError(error) && attempt < VERIFICATION_TOKEN_TX_MAX_ATTEMPTS) {
        continue
      }
      console.error("[generateVerificationToken]", {
        category: "concurrency_or_db",
        attempt,
      })
      throw error
    }
  }

  // Inatteignable : la boucle retourne ou throw
  throw new Error("generateVerificationToken: exhausted retries")
}

/**
 * Génère un token de réinitialisation de mot de passe (UUID).
 *
 * @param email - Email du compte
 */
export const generatePasswordResetToken = async (email: string) => {
  const token = uuidv4()
  const expires = new Date(new Date().getTime() + PASSWORD_RESET_TOKEN_TTL_MS)

  const existingToken = await getPasswordResetTokenByEmail(email)

  if (existingToken) {
    await db.passwordResetToken.delete({
      where: {
        id: existingToken.id,
      },
    })
  }

  const passwordResetToken = await db.passwordResetToken.create({
    data: {
      email,
      token,
      expires,
    },
  })

  return passwordResetToken
}
