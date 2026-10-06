"use server"

import * as z from "zod"
import { ResendVerificationSchema } from "@/schemas"
import { getUserByEmail } from "@/actions/auth"
import { sendTwoFactorTokenEmail } from "@/lib/mail"
import { generateVerificationToken } from "@/lib/token"
import { normalizeEmail } from "@/lib/utils"
import {
  RESEND_VERIFICATION_PUBLIC_OK,
  type ResendVerificationResult,
} from "@/lib/auth/verification-messages"

/**
 * Demande un nouveau code de confirmation d'inscription.
 * Anti-énumération stricte : même forme publique pour absent / confirmé / cooldown /
 * succès / échec provider. Cooldown basé sur createdAt (autorité DB).
 * Si token verrouillé et cooldown écoulé, une nouvelle génération remet
 * failedAttempts/lockedAt à zéro.
 * En cas d'échec provider : le token créé est conservé (cooldown intact).
 * Ne journalise jamais l'email, le code ou le token.
 *
 * Limite résiduelle : l'envoi SMTP reste hors transaction DB ; un second appel
 * concurrent observe le cooldown après sérialisation et n'envoie pas.
 *
 * @param values - { email }
 */
export async function resendVerificationCode(
  values: z.infer<typeof ResendVerificationSchema>,
): Promise<ResendVerificationResult> {
  const parsed = ResendVerificationSchema.safeParse(values)
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ||
        "Une adresse e-mail valide est requise",
    }
  }

  const normalizedEmail = normalizeEmail(parsed.data.email)

  try {
    const user = await getUserByEmail(normalizedEmail)

    // Compte absent, déjà confirmé, ou sans email → même réponse publique
    if (!user || !user.email || user.emailVerified) {
      return { ...RESEND_VERIFICATION_PUBLIC_OK }
    }

    const generation = await generateVerificationToken(
      normalizedEmail,
      "resend",
    )

    if (generation.status === "cooldown") {
      return { ...RESEND_VERIFICATION_PUBLIC_OK }
    }

    const emailSent = await sendTwoFactorTokenEmail(
      generation.token.email,
      generation.token.token,
    )

    if (!emailSent) {
      // Conserver le token pour le cooldown serveur.
      console.warn("[resendVerificationCode]", { category: "provider_error" })
    }

    return { ...RESEND_VERIFICATION_PUBLIC_OK }
  } catch {
    // Éviter une forme qui distinguerait l'existence du compte
    console.error("[resendVerificationCode]", { category: "exception" })
    return { ...RESEND_VERIFICATION_PUBLIC_OK }
  }
}
