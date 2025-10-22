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
        await signIn(
            "credentials",
            {
                email,
                password,
                redirectTo: callbackUrl || DEFAULT_LOGIN_REDIRECT
            }
        )
    } catch (error) {
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