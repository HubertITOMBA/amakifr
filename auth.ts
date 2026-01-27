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
	// En production, utiliser AUTH_URL si disponible, sinon utiliser NEXT_PUBLIC_APP_URL
	baseUrl: process.env.NODE_ENV === 'production' 
		? (process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://amaki.fr')
		: undefined,
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
			// Autoriser OAuth sans vérification d'email
			// Les sessions multiples sont supportées : chaque navigateur/appareil a ses propres cookies JWT
			// Le cookie PKCE est isolé par navigateur, donc plusieurs connexions simultanées sont possibles
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
			try {
				if (token.sub && session.user) {
					session.user.id = token.sub;
				}

				if (token.role && session.user) {
					// Normaliser le rôle pour s'assurer qu'il est en majuscules
					// Cela garantit la compatibilité après la migration Admin -> ADMIN
					const normalizedRole = token.role.toString().trim().toUpperCase() as UserRole;
					session.user.role = normalizedRole;
					
					// Log en développement pour déboguer
					if (process.env.NODE_ENV === 'development') {
						console.log("[auth] Session callback - token.role:", token.role, "normalisé:", normalizedRole, "email:", session.user.email);
					}
				}

				// Propager des métadonnées supplémentaires à la session
				if (session.user) {
					// @ts-ignore - enrichir l'objet user dynamiquement
					session.user.lastLogin = token.lastLogin as string | undefined;
					// @ts-ignore
					session.user.createdAt = token.createdAt as string | undefined;
					// @ts-ignore
					session.user.status = token.status as string | undefined;
					// @ts-ignore - sessionId pour le tracking
					session.user.sessionId = token.jti as string | undefined;
				}

				// Mettre à jour l'activité de la session dans Redis (non-bloquant)
				if (token.jti && token.sub) {
					// Exécution asynchrone sans attendre pour éviter les timeouts
					Promise.resolve().then(async () => {
						try {
							const { updateSessionActivity } = await import("@/lib/session-tracker");
							await updateSessionActivity(token.sub!, token.jti as string);
						} catch (error) {
							// Ignorer silencieusement si Redis n'est pas disponible
						}
					});
				}

				return session;
			} catch (error) {
				console.error("[auth] Erreur dans le callback session:", error);
				// Retourner la session même en cas d'erreur pour ne pas bloquer l'utilisateur
				return session;
			}
		},

		async jwt({ token, trigger, session }) {
			try {
				if (!token.sub) return token;

				const existingUser = await getUserById(token.sub);

				if (!existingUser) return token;

				// Générer un sessionId unique si ce n'est pas déjà fait
				if (!token.jti) {
					token.jti = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
				}

				// Normaliser le rôle pour s'assurer qu'il est en majuscules
				// Cela garantit la compatibilité après la migration Admin -> ADMIN
				const normalizedRole = existingUser.role?.toString().trim().toUpperCase() as UserRole;
				token.role = normalizedRole;
				
				// Log en développement pour déboguer
				if (process.env.NODE_ENV === 'development') {
					console.log("[auth] JWT callback - existingUser.role:", existingUser.role, "normalisé:", normalizedRole, "email:", existingUser.email);
				}
				// Ajouter des champs supplémentaires pour utilisation côté client
				token.lastLogin = existingUser.lastLogin ? existingUser.lastLogin.toISOString() : undefined;
				token.createdAt = existingUser.createdAt ? existingUser.createdAt.toISOString() : undefined;
				token.status = existingUser.status;

				// Tracker la session dans Redis (non-bloquant, uniquement lors de la création ou mise à jour)
				if (trigger === "signIn" || trigger === "update") {
					// Exécution asynchrone sans attendre pour éviter les timeouts
					Promise.resolve().then(async () => {
						try {
							const { trackSession } = await import("@/lib/session-tracker");
							await trackSession(
								token.sub!,
								token.jti as string,
								existingUser.email || "",
								existingUser.name || "",
								"unknown", // IP sera récupérée dans le callback session
								"unknown" // UserAgent sera récupéré dans le callback session
							);
						} catch (error) {
							// Ignorer silencieusement si Redis n'est pas disponible
						}
					});
				}

				// Vérifier si le token est dans la liste noire (non-bloquant)
				if (token.jti) {
					Promise.resolve().then(async () => {
						try {
							const { isTokenBlacklisted } = await import("@/lib/session-tracker");
							const isBlacklisted = await isTokenBlacklisted(token.jti as string);
							if (isBlacklisted) {
								// Token révoqué, on devrait invalider la session
								// Mais on ne peut pas le faire de manière non-bloquante
								console.warn("[Auth] Token révoqué détecté:", token.jti);
							}
						} catch (error) {
							// Ignorer silencieusement si Redis n'est pas disponible
						}
					});
				}

				return token;
			} catch (error) {
				console.error("[auth] Erreur dans le callback JWT:", error);
				// Retourner le token même en cas d'erreur pour ne pas bloquer l'utilisateur
				return token;
			}
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
		// Avec la stratégie JWT, chaque navigateur/appareil a ses propres cookies de session
		// Cela permet naturellement plusieurs sessions simultanées pour le même utilisateur
		// Les sessions sont isolées par navigateur/appareil et ne se chevauchent pas
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
			// Utiliser un nom simple sans préfixe __Host- pour éviter les problèmes
			// Le préfixe __Host- nécessite des conditions strictes qui peuvent causer des problèmes
			name: process.env.NODE_ENV === 'production'
				? '__Secure-next-auth.csrf-token'
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
			// Utiliser un nom simple sans préfixe __Secure- pour éviter les problèmes de parsing
			// Le préfixe __Secure- peut causer des problèmes si le cookie n'est pas correctement formaté
			// Utiliser le même nom en développement et production pour éviter les conflits
			// IMPORTANT: Chaque navigateur/appareil a ses propres cookies, donc les sessions multiples
			// sont supportées naturellement. Le cookie PKCE est isolé par navigateur.
			name: 'next-auth.pkce.code_verifier',
			options: {
				httpOnly: true,
				sameSite: 'lax' as const,
				path: '/',
				secure: process.env.NODE_ENV === 'production',
				maxAge: 60 * 10, // Réduire à 10 minutes pour éviter les conflits entre sessions multiples
				// Ne pas définir le domaine pour permettre l'accès depuis différentes URLs
				// Cela permet au cookie d'être accessible depuis n'importe quelle URL du domaine
				// Chaque navigateur/appareil aura son propre cookie PKCE isolé
			},
		},
	},
	...authConfig,
});
