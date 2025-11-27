"use server"

import { LoginSchema } from "@/schemas"
import * as z from "zod"
import { getUserByEmail } from "."
import { generateVerificationToken } from "@/lib/token"
import { sendTwoFactorTokenEmail } from "@/lib/mail"
import { DEFAULT_LOGIN_REDIRECT } from "@/routes"
import { AuthError } from "next-auth"
import { signIn } from "@/auth"

export const login = async (
    values: z.infer<typeof LoginSchema>,
    callbackUrl: string | null
) => {

    const validatedFields = LoginSchema.safeParse(values)

    if(!validatedFields.success) {
        return { error: "Champs non valides !" }
    }

    const { email, password } = validatedFields.data

    const existingUser = await getUserByEmail(email)

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
        // signIn peut lancer une NEXT_REDIRECT qui est normale dans Next.js
        // On essaie de capturer cette erreur spéciale
        const result = await signIn(
            "credentials",
            {
                email,
                password,
                redirectTo: callbackUrl || DEFAULT_LOGIN_REDIRECT
            }
        )
        // Si signIn retourne sans erreur, la connexion a réussi
        // La redirection sera gérée automatiquement par NextAuth
        return { success: "Connexion réussie !" }
    } catch (error: any) {
        // NextAuth peut lancer une NEXT_REDIRECT qui est une erreur spéciale
        // que Next.js gère automatiquement. Si c'est le cas, la connexion a réussi
        if (error?.digest?.startsWith('NEXT_REDIRECT') || error?.message?.includes('NEXT_REDIRECT')) {
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

        throw error
    }

}