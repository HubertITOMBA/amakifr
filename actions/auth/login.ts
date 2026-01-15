"use server"

import { LoginSchema } from "@/schemas"
import * as z from "zod"
import { getUserByEmail } from "."
import { generateVerificationToken } from "@/lib/token"
import { sendTwoFactorTokenEmail } from "@/lib/mail"
import { DEFAULT_LOGIN_REDIRECT } from "@/routes"
import { AuthError } from "next-auth"
import { signIn } from "@/auth"
import { normalizeEmail } from "@/lib/utils"

export const login = async (
    values: z.infer<typeof LoginSchema>,
    callbackUrl: string | null
) => {

    const validatedFields = LoginSchema.safeParse(values)

    if(!validatedFields.success) {
        return { error: "Champs non valides !" }
    }

    const { email, password } = validatedFields.data

    // Normaliser l'email pour la recherche case-insensitive
    const normalizedEmail = normalizeEmail(email);

    const existingUser = await getUserByEmail(normalizedEmail)

    if(!existingUser || !existingUser.password || !existingUser.email) {
        return { error: "L'e-mail n'existe pas !"}
    }

    if(!existingUser.emailVerified) {
        const verificationToken = await generateVerificationToken(existingUser.email)

        await sendTwoFactorTokenEmail(
            verificationToken.email,
            verificationToken.token
        )

        return { twoFactor: true, success: "Code OTP envoyé !" }
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
            return { error: result.error };
        }
        
        // Vérifier si result est undefined ou null (peut arriver avec redirect: false)
        if (!result || result.error) {
            return { error: "Identifiants non valides!" };
        }
        
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