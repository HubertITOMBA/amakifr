import { NextAuthConfig } from "next-auth";
import bcrypt from "bcryptjs";
import Google from "next-auth/providers/google";
// Désactivé temporairement - trop de contraintes
// import Facebook from "next-auth/providers/facebook";
// import Apple from "next-auth/providers/apple";
import Credentials from "next-auth/providers/credentials";

import { LoginSchema } from "@/schemas";
import { getUserByEmail } from "@/actions/auth/index";
import { normalizeEmail } from "@/lib/utils";

export default {
	secret: process.env.AUTH_SECRET,
	// trustHost est défini dans auth.ts, ne pas le redéfinir ici
	providers: [
		Google({
			clientId: process.env.GOOGLE_CLIENT_ID,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET,
		}),
		// Désactivé temporairement - trop de contraintes
		// Facebook({
		// 	clientId: process.env.FACEBOOK_CLIENT_ID,
		// 	clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
		// }),
		// Apple({
		// 	clientId: process.env.APPLE_ID,
		// 	clientSecret: process.env.APPLE_SECRET,
		// 	// Apple nécessite un teamId et keyId pour la génération du secret
		// 	// Ces valeurs sont optionnelles si APPLE_SECRET est déjà configuré
		// }),
		Credentials({
			async authorize(credentials) {
				try {
					const validatedFields = LoginSchema.safeParse(credentials);

					if (!validatedFields.success) {
						console.error("[auth] Validation des champs échouée:", validatedFields.error);
						return null;
					}

					const { email, password } = validatedFields.data;
					// Normaliser l'email pour la recherche case-insensitive
					const normalizedEmail = normalizeEmail(email);
					const user = await getUserByEmail(normalizedEmail);

					if (!user) {
						console.error("[auth] Utilisateur non trouvé:", email);
						return null;
					}

					if (!user.password) {
						console.error("[auth] Utilisateur sans mot de passe:", email);
						return null;
					}

					const passwordsMatch = await bcrypt.compare(password, user.password);

					if (!passwordsMatch) {
						console.error("[auth] Mot de passe incorrect pour:", email);
						return null;
					}

					// Vérifier si le compte est inactif
					if (user.status === 'Inactif') {
						console.error("[auth] Tentative de connexion avec un compte inactif:", email);
						// Retourner null pour bloquer la connexion
						// Le message d'erreur sera géré dans login.ts
						return null;
					}

					// Retourner l'utilisateur si tout est correct
					return user;
				} catch (error) {
					console.error("[auth] Erreur lors de l'autorisation:", error);
					return null;
				}
			},
		}),
	],
} satisfies NextAuthConfig;
