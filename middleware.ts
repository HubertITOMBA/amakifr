import { NextRequest, NextResponse } from "next/server";
import { addSecurityHeaders } from "@/lib/security-headers";
import { checkRateLimit, getRateLimitIdentifier, rateLimitPresets } from "@/lib/rate-limit";
import { auth } from "@/auth"; // Importer directement depuis auth.ts pour utiliser la même instance

import { 
    DEFAULT_LOGIN_REDIRECT,
    apiAuthPrefix,
    authRoutes,
    isPublicRoute,
  } from "@/routes";

export default auth(async (req: NextRequest) => {
    const { nextUrl } = req;
    const isApiAuthRoute = nextUrl.pathname.startsWith(apiAuthPrefix);
    
    // Ne pas interférer avec les routes API d'authentification
    // Laisser NextAuth gérer ces routes directement (y compris les cookies PKCE)
    // IMPORTANT: Ne jamais modifier les cookies sur ces routes car cela peut corrompre le flux OAuth
    if (isApiAuthRoute) {
        const response = NextResponse.next();
        return addSecurityHeaders(response, req);
    }
    
    // Ne pas supprimer les cookies sur les routes d'authentification (y compris pendant le flux OAuth)
    // Cela inclut les routes /auth/* qui sont utilisées pour les callbacks OAuth
    const isAuthCallbackRoute = nextUrl.pathname.startsWith('/auth/') && 
                                (nextUrl.pathname.includes('callback') || 
                                 nextUrl.searchParams.has('code') || 
                                 nextUrl.searchParams.has('state'));
    
    // Vérifier les routes d'authentification AVANT de vérifier l'état de connexion
    // pour éviter les boucles de redirection
    const isAuthRoute = authRoutes.includes(nextUrl.pathname);
    const isPublicRouteCheck = isPublicRoute(nextUrl.pathname);
    
    // Vérifier si des cookies d'authentification existent
    const hasAuthCookies = req.cookies.has('next-auth.session-token') || 
                           req.cookies.has('__Secure-next-auth.session-token') ||
                           req.cookies.has('authjs.session-token') ||
                           req.cookies.has('authjs.csrf-token') ||
                           req.cookies.has('next-auth.pkce.code_verifier') ||
                           req.cookies.has('__Secure-next-auth.pkce.code_verifier');
    
    // req.auth peut être undefined si les cookies sont invalides (ancien secret, domaine différent)
    // Dans ce cas, NextAuth logge l'erreur mais continue l'exécution
    // Vérifier explicitement que req.auth existe ET a un user valide avec un id
    const isLoggedIn = !!(req.auth?.user && req.auth.user.id);
    
    // Debug en développement
    if (process.env.NODE_ENV === 'development') {
        if (nextUrl.pathname === '/auth/sign-in' || nextUrl.pathname.startsWith('/admin') || nextUrl.pathname === '/') {
            const host = req.headers.get('host') || 'unknown';
            console.log('[Middleware]', nextUrl.pathname, '- Host:', host, '- isAuthRoute:', isAuthRoute, 'isPublicRoute:', isPublicRouteCheck, 'isLoggedIn:', isLoggedIn, 'req.auth:', !!req.auth, 'req.auth?.user:', !!req.auth?.user, 'user.id:', req.auth?.user?.id, 'user.email:', req.auth?.user?.email, 'user.role:', req.auth?.user?.role);
            if (hasAuthCookies && !req.auth) {
                console.log('[Middleware] ⚠️ Cookies présents mais req.auth est undefined - cookies:', {
                    'next-auth.session-token': req.cookies.has('next-auth.session-token'),
                    '__Secure-next-auth.session-token': req.cookies.has('__Secure-next-auth.session-token'),
                    'authjs.session-token': req.cookies.has('authjs.session-token'),
                    'next-auth.csrf-token': req.cookies.has('next-auth.csrf-token'),
                });
            }
            // Afficher tous les cookies pour le débogage
            const allCookies = req.cookies.getAll();
            const authCookiesList = allCookies.filter(c => c.name.includes('auth') || c.name.includes('session'));
            if (authCookiesList.length > 0) {
                console.log('[Middleware] Cookies d\'authentification trouvés:', authCookiesList.map(c => c.name));
            }
        }
    }
    
    // Si des cookies existent mais req.auth n'est pas valide, les supprimer
    // MAIS seulement si on n'est pas sur une route d'authentification (pour éviter de supprimer les cookies pendant la connexion)
    // Et seulement si on n'est pas sur une route publique (pour éviter de supprimer les cookies sur les pages publiques)
    // Et seulement si on n'est pas sur une route de callback OAuth (pour éviter de supprimer les cookies PKCE pendant le flux OAuth)
    // Ne supprimer les cookies que si on est sûr qu'ils sont invalides (pas de req.auth du tout)
    // ET seulement après un délai pour permettre à la session de s'établir après la connexion
    // Ne pas supprimer les cookies sur la page d'accueil "/" même si elle est publique, car c'est la destination après connexion
    // Ne pas supprimer les cookies si on vient juste de se connecter (détecter via un header ou un paramètre)
    // Ou si on est sur la page d'accueil avec le paramètre loggedIn
    const isJustLoggedIn = req.headers.get('x-just-logged-in') === 'true' || 
                           nextUrl.searchParams.get('loggedIn') === 'true' ||
                           (nextUrl.pathname === '/' && nextUrl.searchParams.has('loggedIn'));
    
    if (hasAuthCookies && !req.auth && !isAuthRoute && !isPublicRouteCheck && !isAuthCallbackRoute && 
        nextUrl.pathname !== '/' && !isJustLoggedIn) {
        const response = NextResponse.next();
        // Ne supprimer que les cookies de session, PAS les cookies PKCE (ils sont nécessaires pour le flux OAuth)
        response.cookies.set('next-auth.session-token', '', { expires: new Date(0), path: '/' });
        response.cookies.set('__Secure-next-auth.session-token', '', { expires: new Date(0), path: '/' });
        response.cookies.set('next-auth.csrf-token', '', { expires: new Date(0), path: '/' });
        response.cookies.set('authjs.session-token', '', { expires: new Date(0), path: '/' });
        response.cookies.set('authjs.csrf-token', '', { expires: new Date(0), path: '/' });
        // NE PAS supprimer les cookies PKCE ici car ils sont nécessaires pour le flux OAuth
        return addSecurityHeaders(response, req);
    }
    
    // Rate limiting pour les routes API critiques
    if (nextUrl.pathname.startsWith('/api/')) {
        // Déterminer le preset selon le type d'endpoint
        let preset = rateLimitPresets.api;
        
        if (nextUrl.pathname.startsWith('/api/auth/')) {
            preset = rateLimitPresets.auth;
        } else if (nextUrl.pathname.includes('/upload') || nextUrl.pathname.includes('/galerie/upload')) {
            preset = rateLimitPresets.upload;
        } else if (nextUrl.pathname.includes('/webhooks/')) {
            preset = rateLimitPresets.webhook;
        }
        
        const identifier = getRateLimitIdentifier(req);
        // checkRateLimit est maintenant async, utiliser await
        const rateLimitResult = await checkRateLimit(identifier, preset);
        
        if (!rateLimitResult.allowed) {
            const response = NextResponse.json(
                { 
                    error: 'Trop de requêtes. Veuillez réessayer plus tard.',
                    retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
                },
                { status: 429 }
            );
            
            // Ajouter les headers de rate limit
            response.headers.set('X-RateLimit-Limit', preset.maxRequests.toString());
            response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
            response.headers.set('X-RateLimit-Reset', new Date(rateLimitResult.resetTime).toISOString());
            response.headers.set('Retry-After', Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString());
            
            return addSecurityHeaders(response, req);
        }
    }

    // Gérer les routes d'authentification
    if (isAuthRoute) {
        // Vérifier strictement que req.auth existe ET a un user valide avec un id
        // Si req.auth existe mais n'a pas de user.id, c'est probablement une session invalide
        const hasValidSession = req.auth?.user && req.auth.user.id;
        
        if (hasValidSession) {
            // L'utilisateur est vraiment connecté, rediriger vers la page d'accueil
            try {
                const redirectUrl = new URL(DEFAULT_LOGIN_REDIRECT, nextUrl);
                const response = Response.redirect(redirectUrl);
                return addSecurityHeaders(response as NextResponse, req);
            } catch (error) {
                console.error('[Middleware] Erreur lors de la redirection:', error);
                // En cas d'erreur, laisser passer pour éviter une boucle
                const response = NextResponse.next();
                return addSecurityHeaders(response, req);
            }
        }
        
        // Sinon, laisser passer pour permettre l'accès à la page de connexion
        // Même si req.auth existe partiellement, si user.id n'existe pas, on considère la session invalide
        const response = NextResponse.next();
        return addSecurityHeaders(response, req);
    }

    // Pour les routes admin, vérifier aussi le rôle
    // Les rôles autorisés sont : ADMIN, PRESID, VICEPR, SECRET, VICESE, COMCPT
    const isAdminRoute = nextUrl.pathname.startsWith('/admin');
    if (isAdminRoute && isLoggedIn) {
        // Normaliser le rôle pour gérer les cas où il pourrait être en minuscules
        const userRole = req.auth?.user?.role;
        const normalizedRole = userRole?.toString().trim().toUpperCase();
        
        // Liste des rôles autorisés à accéder au panel admin
        const adminRoles = ['ADMIN', 'PRESID', 'VICEPR', 'SECRET', 'VICESE', 'COMCPT', 'TRESOR', 'VTRESO'];
        const hasAdminAccess = normalizedRole && adminRoles.includes(normalizedRole);
        
        if (!hasAdminAccess) {
            // L'utilisateur est connecté mais n'a pas un rôle admin, rediriger vers la page d'accueil
            console.log('[Middleware] Accès admin refusé - rôle:', userRole, 'normalisé:', normalizedRole, 'email:', req.auth?.user?.email);
            try {
                const redirectUrl = new URL('/', nextUrl);
                const response = Response.redirect(redirectUrl);
                return addSecurityHeaders(response as NextResponse, req);
            } catch (error) {
                console.error('[Middleware] Erreur lors de la redirection admin:', error);
                // En cas d'erreur, laisser passer pour éviter une boucle
                const response = NextResponse.next();
                return addSecurityHeaders(response, req);
            }
        } else {
            console.log('[Middleware] Accès admin autorisé - rôle:', userRole, 'normalisé:', normalizedRole, 'email:', req.auth?.user?.email);
        }
    }

    if (!isLoggedIn && !isPublicRouteCheck) {
        try {
            let callbackUrl = nextUrl.pathname;
            if (nextUrl.search) {
                callbackUrl += nextUrl.search;
            }

            const encodedCallbackUrl = encodeURIComponent(callbackUrl);
            const redirectUrl = new URL(
                `/auth/sign-in?callbackUrl=${encodedCallbackUrl}`, 
                nextUrl
            );
            const response = Response.redirect(redirectUrl);
            return addSecurityHeaders(response as NextResponse, req);
        } catch (error) {
            console.error('[Middleware] Erreur lors de la redirection vers sign-in:', error);
            // En cas d'erreur, laisser passer pour éviter une boucle
            const response = NextResponse.next();
            return addSecurityHeaders(response, req);
        }
    }

    const response = NextResponse.next();
    return addSecurityHeaders(response, req);
});

export const config = {
    matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
}