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
	trustHost: true, // Permettre l'accès depuis différentes URLs en développement
	// En développement, ne pas définir baseUrl pour permettre l'accès depuis localhost et l'IP réseau
	// NextAuth détectera automatiquement l'URL depuis la requête
	// En production, utiliser AUTH_URL si disponible
	...(process.env.NODE_ENV === 'production' && process.env.AUTH_URL && { baseUrl: process.env.AUTH_URL }),
	// Configuration pour gérer les erreurs CSRF en développement
	// En développement, on peut être plus permissif avec les erreurs CSRF
	// mais on ne peut pas complètement désactiver la vérification pour des raisons de sécurité
	debug: process.env.NODE_ENV === 'development',
	pages: {
		signIn: "/auth/sign-in",
		error: "/auth/error",
	},
	events: {
		async linkAccount({ user }) {
			// Mettre à jour l'utilisateur pour marquer l'email comme vérifié
			const updatedUser = await db.user.update({
				where: {
					id: user.id,
				},
				data: {
					emailVerified: new Date(),
				},
			});

			// Vérifier si l'utilisateur a déjà un adhérent
			const existingAdherent = await db.adherent.findUnique({
				where: {
					userId: user.id,
				},
			});

			// Si l'adhérent n'existe pas, le créer
			if (!existingAdherent) {
				// Extraire le prénom et nom depuis le champ name de l'utilisateur
				// Si name n'est pas disponible, utiliser l'email comme fallback
				const fullName = updatedUser.name || updatedUser.email || 'Utilisateur';
				const firstname = fullName.split(' ')[0] || fullName;
				const lastname = fullName.split(' ').slice(1).join(' ') || fullName;

				// Créer l'adhérent avec les champs requis
				try {
					if (user.id) {
						await db.adherent.create({
							data: {
								userId: user.id,
								firstname: firstname,
								lastname: lastname,
							},
						});
					}
				} catch (error) {
					console.error("[auth] Erreur lors de la création de l'adhérent:", error);
					// Ne pas bloquer le processus d'authentification si la création échoue
				}
			}
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
				
				// Si l'utilisateur n'existe pas, refuser la connexion
				if (!existingUser) {
					console.error("[auth] Utilisateur non trouvé lors de la connexion:", user.id);
					return false;
				}
				
				// Vérifier que l'email est vérifié (emailVerified doit être une date, pas null)
				if (!existingUser.emailVerified) {
					console.warn("[auth] Tentative de connexion avec email non vérifié:", existingUser.email);
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
	// Utiliser l'adapter Prisma uniquement pour les comptes OAuth (Account, VerificationToken)
	// Avec la stratégie JWT, les sessions ne sont pas stockées en base de données
	// L'adapter est nécessaire pour les comptes OAuth mais peut causer des problèmes avec JWT
	// On le garde pour OAuth mais on s'assure que les sessions JWT ne l'utilisent pas
	adapter: PrismaAdapter(db),
	session: {
		strategy: "jwt",
		maxAge: 30 * 60, // 30 minutes
		updateAge: 24 * 60 * 60, // Mettre à jour la session toutes les 24 heures
	},
	// Configuration de sécurité
	// En développement, désactiver useSecureCookies pour permettre l'accès HTTP depuis l'adresse réseau
	useSecureCookies: process.env.NODE_ENV === 'production',
	// Configuration des cookies pour permettre l'accès depuis localhost et l'adresse réseau
	// En développement, ne pas utiliser les préfixes __Host- et __Secure- car ils nécessitent HTTPS
	// NextAuth.js gère automatiquement les cookies PKCE, donc on ne les configure pas manuellement
	cookies: {
		sessionToken: {
			name: process.env.NODE_ENV === 'production' 
				? '__Secure-next-auth.session-token'
				: 'next-auth.session-token',
			options: {
				httpOnly: true,
				sameSite: 'lax' as const,
				path: '/',
				secure: process.env.NODE_ENV === 'production',
				// Ne pas définir le domaine pour permettre l'accès depuis différentes URLs (localhost, IP réseau, etc.)
				// Cela permet aux cookies d'être accessibles depuis n'importe quelle URL
			},
		},
		csrfToken: {
			// En développement, ne pas utiliser __Host- car il nécessite HTTPS et ne fonctionne pas avec HTTP
			name: process.env.NODE_ENV === 'production'
				? '__Host-next-auth.csrf-token'
				: 'next-auth.csrf-token',
			options: {
				httpOnly: true, // Le token CSRF doit rester httpOnly pour la sécurité
				sameSite: 'lax' as const,
				path: '/',
				secure: process.env.NODE_ENV === 'production',
				// Ne pas définir le domaine pour permettre l'accès depuis différentes URLs
			},
		},
		pkceCodeVerifier: {
			// En développement, ne pas utiliser __Secure- car il nécessite HTTPS
			name: process.env.NODE_ENV === 'production'
				? '__Secure-next-auth.pkce.code_verifier'
				: 'next-auth.pkce.code_verifier',
			options: {
				httpOnly: true,
				sameSite: 'lax' as const,
				path: '/',
				secure: process.env.NODE_ENV === 'production',
				maxAge: 60 * 15, // 15 minutes
				// Ne pas définir le domaine pour permettre l'accès depuis différentes URLs
			},
		},
	},
	...authConfig,
});
