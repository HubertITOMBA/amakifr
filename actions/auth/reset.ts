"use server";

import { ResetSchema } from "@/schemas";
import * as z from "zod";
import { error } from "console";
import { getUserByEmail, getUserById } from ".";
import { generatePasswordResetToken } from "@/lib/token";
import { sendPasswordResetToken } from "@/lib/mail";


export const reset = async(
    values: z.infer<typeof ResetSchema>,
) => {

    const validatedFields = ResetSchema.safeParse(values);

    if(!validatedFields.success) {
        return { error: "Champs invalides !" }
    }

    const { email } = validatedFields.data;

    const existingUser = await getUserByEmail(email)

    if(!existingUser){
        return { error: "Email non trouvé !"}
    }

    const passwordResetToken = await generatePasswordResetToken(email)

    await sendPasswordResetToken(
        passwordResetToken.email,
        passwordResetToken.token
    )

    return { success: "L'e-mail de Réinitialisation est envoyé !"}

}