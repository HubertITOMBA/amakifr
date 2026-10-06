"use server"

import { LoginSchema } from "@/schemas"
import * as z from "zod"
import { getUserByEmail } from "@/actions/auth/index"
import { generateVerificationToken } from "@/lib/token"
import { sendTwoFactorTokenEmail } from "@/lib/mail"
import { AuthError } from "next-auth"
import { signIn } from "@/auth"
import { normalizeEmail } from "@/lib/utils"
export const login = async (
    values: z.infer<typeof LoginSchema>,
    callbackUrl: string | null
) => {

    const validatedFields = LoginSchema.safeParse(values)

    if(!validatedFields.success) {
        return { error: "Champs non valides !" }
    }

    const { email, password } = validatedFields.data

    // Normaliser l'email pour la recherche case-insensitive
    const normalizedEmail = normalizeEmail(email);

    const existingUser = await getUserByEmail(normalizedEmail)

    if(!existingUser || !existingUser.password || !existingUser.email) {
        return { error: "L'e-mail n'existe pas !"}
    }

    // Vérifier si le compte est inactif
    if(existingUser.status === 'Inactif') {
        return { 
            error: "Votre compte est désactivé. Veuillez contacter le bureau de l'association pour plus d'informations." 
        }
    }

    if(!existingUser.emailVerified) {
        try {
            const generation = await generateVerificationToken(
                existingUser.email,
                "resend",
            )

            if (generation.status === "cooldown") {
                // Ne pas renvoyer d'email ; ne pas prétendre qu'un nouveau code a été envoyé.
                return {
                    verificationRequired: true,
                    twoFactor: true,
                    success:
                        "Un code de confirmation a déjà été demandé récemment. Vérifiez votre e-mail ou réessayez dans une minute.",
                }
            }

            if (generation.status !== "created") {
                console.warn("[login]", { category: "token_generation_refused" })
                return {
                    verificationRequired: true,
                    deliveryFailed: true,
                    message:
                        "Votre compte n'est pas encore confirmé. L'envoi du code a échoué. Vous pouvez demander un nouveau code depuis la page de vérification.",
                }
            }

            const emailSent = await sendTwoFactorTokenEmail(
                generation.token.email,
                generation.token.token,
            )

            if (!emailSent) {
                console.warn("[login]", { category: "provider_error" })
                return {
                    verificationRequired: true,
                    deliveryFailed: true,
                    message:
                        "Votre compte n'est pas encore confirmé. L'envoi du code a échoué. Vous pouvez demander un nouveau code depuis la page de vérification.",
                }
            }

            return { twoFactor: true, success: "Code OTP envoyé !" }
        } catch {
            console.error("[login]", { category: "verification_exception" })
            return {
                verificationRequired: true,
                deliveryFailed: true,
                message:
                    "Votre compte n'est pas encore confirmé. L'envoi du code a échoué. Vous pouvez demander un nouveau code depuis la page de vérification.",
            }
        }
    }

    try {
        // Utiliser redirect: false pour éviter les problèmes de redirection
        // La redirection sera gérée côté client après la mise à jour de la session
        const result = await signIn(
            "credentials",
            {
                email: normalizedEmail, // Utiliser l'email normalisé
                password,
                redirect: false, // Ne pas rediriger automatiquement
            }
        )
        
        // Si on arrive ici, la connexion a réussi
        // Vérifier que result n'est pas une erreur
        if (result?.error) {
            // Si l'erreur est liée à l'email non vérifié, donner un message plus clair
            if (result.error.includes('email') || result.error.includes('vérifié') || result.error.includes('verified')) {
                return { error: "Votre email n'est pas vérifié. Veuillez vérifier votre email avant de vous connecter." };
            }
            return { error: result.error };
        }
        
        // Vérifier si result est undefined ou null (peut arriver avec redirect: false)
        if (!result || result.error) {
            return { error: "Identifiants non valides!" };
        }
        
        // La connexion est enregistrée dans auth.ts (events.signIn) pour tous les utilisateurs
        return { success: "Connexion réussie !" }
    } catch (error: any) {
        // NextAuth peut lancer une NEXT_REDIRECT qui est une erreur spéciale
        // que Next.js gère automatiquement. Si c'est le cas, la connexion a réussi
        if (error?.digest?.startsWith('NEXT_REDIRECT') || 
            error?.message?.includes('NEXT_REDIRECT') ||
            error?.code === 'NEXT_REDIRECT' ||
            error?.name === 'NEXT_REDIRECT') {
            // La redirection est en cours, la connexion a réussi
            return { success: "Connexion réussie !" }
        }
        
        if(error instanceof AuthError) {
            switch(error.type){
                case "CredentialsSignin":
                    return { error: "Identifiants non valides!" }
                default:
                    return { error: "Une erreur s'est produite!" } 
            }
        }

        // Logger l'erreur pour le débogage
        console.error("[login] Erreur inattendue:", error);
        return { error: "Une erreur s'est produite lors de la connexion!" }
    }

}
