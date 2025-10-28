import NextAuth from "next-auth";
import { db } from "./lib/db";
import authConfig from "./auth.config";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { getUserById } from "@/actions/auth";
import { UserRole } from "@prisma/client";

export const {
	handlers: { GET, POST },
	auth,
	signIn,
	signOut,
} = NextAuth({
	pages: {
		signIn: "/auth/sign-in",
		error: "/auth/error",
	},
	events: {
		async linkAccount({ user }) {
			await db.user.update({
				where: {
					id: user.id,
				},
				data: {
					emailVerified: new Date(),
				},
			});

			await db.adherent.create({
				data: {
					User: {
						connect: {
							id: user.id,
						},
					},
				},
			});
		},
		async signIn({ user }) {
			await db.user.update({
				where: {
					id: user.id,
				},
				data: {
					lastLogin: new Date(),
				},
			});
		},
	},
	callbacks: {
		async signIn({ user, account }) {
			//autoriser oauth sans verification de email
			if (account?.provider !== "credentials") return true;

			if (user.id) {
				const existingUser = await getUserById(user.id);
				if (!existingUser || !existingUser.emailVerified) {
					return false;
				}
			}
			return true;
		},

		async session({ token, session }) {
			if (token.sub && session.user) {
				session.user.id = token.sub;
			}

			if (token.role && session.user) {
				session.user.role = token.role as UserRole;
			}

			// Propager des métadonnées supplémentaires à la session
			if (session.user) {
				// @ts-ignore - enrichir l'objet user dynamiquement
				session.user.lastLogin = token.lastLogin as string | undefined;
				// @ts-ignore
				session.user.createdAt = token.createdAt as string | undefined;
				// @ts-ignore
				session.user.status = token.status as string | undefined;
			}

			return session;
		},

		async jwt({ token }) {
			if (!token.sub) return token;

			const existingUser = await getUserById(token.sub);

			if (!existingUser) return token;

			token.role = existingUser.role;
			// Ajouter des champs supplémentaires pour utilisation côté client
			token.lastLogin = existingUser.lastLogin ? existingUser.lastLogin.toISOString() : undefined;
			token.createdAt = existingUser.createdAt ? existingUser.createdAt.toISOString() : undefined;
			token.status = existingUser.status;

			return token;
		},
	},
	adapter: PrismaAdapter(db),
	session: {
		strategy: "jwt",
		maxAge: 30 * 60,
	},
	...authConfig,
});
