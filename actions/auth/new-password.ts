"use server"
import { NewPasswordSchema } from "@/schemas"
import * as z from "zod"
import { getPasswordResetTokenByToken, getUserByEmail } from "."
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"


export const newPassword = async(
    values: z.infer<typeof NewPasswordSchema>,
    token?: string | null
) => {

    if(!token) {
        return { error: "Jeton invalide !"}
    }

    const validatedFields = NewPasswordSchema.safeParse(values);

    if(!validatedFields.success) {
        return { error: "Champs non valides !" }
    }

    const { password } = validatedFields.data

    const existingToken = await getPasswordResetTokenByToken(token)

    if (!existingToken){
        return { error: "Jeton non valide !"}
    }

    const hasExpired = new Date() > new Date(existingToken.expires)

    if(hasExpired){
        return { error: "Le jeton a expiré !" }
    }

    const existingUser = await getUserByEmail(existingToken.email)

    if(!existingUser) {
        return { error: "L'e-mail n'existe pas !" }
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    await db.user.update({
        where: { id: existingUser.id },
        data: {
            password: hashedPassword
        }
    })

    await db.passwordResetToken.delete({
        where: {
            id: existingToken.id
        }
    })

    return { success: "Votre Mot de passe est mis à jour "}

}