"use server"

import { RegisterSchema } from "@/schemas"
import * as z from 'zod'
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { getUserByEmail, getUserByName } from "."
import { sendTwoFactorTokenEmail, sendNewUserNotificationEmail, sendUserRegistrationThankYouEmail } from "@/lib/mail"
import { generateVerificationToken } from "@/lib/token"
import { normalizeEmail } from "@/lib/utils"


export const register = async (
    values: z.infer<typeof RegisterSchema>
) => {
    const validatedFields = RegisterSchema.safeParse(values)

    if(!validatedFields.success) {
        return { error: "Informations de connexion invalides !" }
    }

    const { email, password, name, anneePromotion, pays, ville } = validatedFields.data
    
    // Normaliser l'email en minuscules pour éviter les doublons case-insensitive
    const normalizedEmail = normalizeEmail(email);
    
    const hashPassword = await bcrypt.hash(password, 10)

    const existingUser = await getUserByEmail(normalizedEmail)
    if (existingUser) {
        return { error : "Cet email est déjà utilisé !"}
    }

    // Vérifier l'unicité du nom
    if (name) {
        const existingUserByName = await getUserByName(name)
        if (existingUserByName) {
            return { error: "Ce nom est déjà utilisé par un autre utilisateur !" }
        }
    }

    try {
        const user = await db.user.create({
            data: {
                name,
                email: normalizedEmail, // Utiliser l'email normalisé
                password: hashPassword
            }
        })

        // Stocker les informations optionnelles dans centresInteret (JSON) pour pays et ville
        const infoSupplementaires: {
            pays?: string;
            ville?: string;
        } = {};
        
        if (pays) infoSupplementaires.pays = pays;
        if (ville) infoSupplementaires.ville = ville;

        // Créer l'adhérent avec les informations supplémentaires
        try {
            await db.adherent.create({
                data: {
                    userId: user.id,
                    firstname: name.split(' ')[0] || name,
                    lastname: name.split(' ').slice(1).join(' ') || name,
                    anneePromotion: anneePromotion || null,
                    centresInteret: Object.keys(infoSupplementaires).length > 0 
                        ? JSON.stringify(infoSupplementaires) 
                        : null,
                }
            });
        } catch (error) {
            console.error("Erreur lors de la création de l'adhérent:", error);
            // Ne pas bloquer l'inscription si la création de l'adhérent échoue
        }

        // Envoyer les emails de notification et de remerciement
        try {
            // Email aux administrateurs (utiliser l'email normalisé)
            await sendNewUserNotificationEmail(normalizedEmail, name);
            
            // Email de remerciement à l'utilisateur (utiliser l'email normalisé)
            await sendUserRegistrationThankYouEmail(normalizedEmail, name);
        } catch (error) {
            console.error("Erreur lors de l'envoi des emails:", error);
            // Ne pas bloquer l'inscription si l'envoi d'email échoue
        }
       
        const verificationToken = await generateVerificationToken(normalizedEmail)
        
        // Envoyer l'email de vérification (non bloquant)
        const emailSent = await sendTwoFactorTokenEmail(
            verificationToken.email,
            verificationToken.token,
        )

        if (!emailSent) {
            console.warn("[register] L'envoi de l'email de vérification a échoué, mais l'inscription continue");
            // Ne pas bloquer l'inscription si l'email échoue
        }

        return { 
            success: emailSent ? "Code OTP envoyé !" : "Inscription réussie (l'envoi de l'email a échoué, veuillez contacter l'administrateur)", 
            twoFactor: true 
        }
    } catch (error: any) {
        // Gérer l'erreur de contrainte unique sur le nom
        if (error?.code === 'P2002' && error?.meta?.target?.includes('name')) {
            return { error: "Ce nom est déjà utilisé par un autre utilisateur !" }
        }
        // Gérer l'erreur de contrainte unique sur l'email
        if (error?.code === 'P2002' && error?.meta?.target?.includes('email')) {
            return { error: "Cet email est déjà utilisé !" }
        }
        console.error("Erreur lors de l'inscription:", error);
        return { error: "Une erreur s'est produite lors de l'inscription. Veuillez réessayer." }
    }
} 