import { NextAuthConfig } from "next-auth";
import bcrypt from "bcryptjs";
import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";
import Apple from "next-auth/providers/apple";
import Credentials from "next-auth/providers/credentials";

import { LoginSchema } from "@/schemas";
import { getUserByEmail } from "@/actions/auth/index";

export default {
	secret: process.env.AUTH_SECRET,
	trustHost: true, // Permettre l'accès depuis différentes URLs en développement
	providers: [
		Google({
			clientId: process.env.GOOGLE_CLIENT_ID,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET,
		}),
		Facebook({
			clientId: process.env.FACEBOOK_CLIENT_ID,
			clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
		}),
		Apple({
			clientId: process.env.APPLE_ID,
			clientSecret: process.env.APPLE_SECRET,
			// Apple nécessite un teamId et keyId pour la génération du secret
			// Ces valeurs sont optionnelles si APPLE_SECRET est déjà configuré
		}),
		Credentials({
			async authorize(credentials) {
				const validatedFields = LoginSchema.safeParse(credentials);

				if (validatedFields.success) {
					const { email, password } = validatedFields.data;
					const user = await getUserByEmail(email);

					if (!user || !user.password) {
						return null;
					}

					const passwordsMatch = await bcrypt.compare(password, user.password);

					if (passwordsMatch) return user;
				}

				return null;
			},
		}),
	],
} satisfies NextAuthConfig;
