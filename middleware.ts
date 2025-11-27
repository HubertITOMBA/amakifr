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

export default auth((req: NextRequest) => {
    const { nextUrl } = req;
    const isApiAuthRoute = nextUrl.pathname.startsWith(apiAuthPrefix);
    
    // Ne pas interférer avec les routes API d'authentification
    // Laisser NextAuth gérer ces routes directement
    if (isApiAuthRoute) {
        const response = NextResponse.next();
        return addSecurityHeaders(response, req);
    }
    
    // Vérifier les routes d'authentification AVANT de vérifier l'état de connexion
    // pour éviter les boucles de redirection
    const isAuthRoute = authRoutes.includes(nextUrl.pathname);
    const isPublicRouteCheck = isPublicRoute(nextUrl.pathname);
    
    // Vérifier si des cookies d'authentification existent
    const hasAuthCookies = req.cookies.has('next-auth.session-token') || 
                           req.cookies.has('__Secure-next-auth.session-token') ||
                           req.cookies.has('authjs.session-token') ||
                           req.cookies.has('authjs.csrf-token');
    
    // req.auth peut être undefined si les cookies sont invalides (ancien secret, domaine différent)
    // Dans ce cas, NextAuth logge l'erreur mais continue l'exécution
    // Vérifier explicitement que req.auth existe ET a un user valide avec un id
    const isLoggedIn = !!(req.auth?.user && req.auth.user.id);
    
    // Debug en développement
    if (process.env.NODE_ENV === 'development') {
        if (nextUrl.pathname === '/auth/sign-in' || nextUrl.pathname.startsWith('/admin')) {
            console.log('[Middleware]', nextUrl.pathname, '- isAuthRoute:', isAuthRoute, 'isPublicRoute:', isPublicRouteCheck, 'isLoggedIn:', isLoggedIn, 'req.auth:', !!req.auth, 'req.auth?.user:', !!req.auth?.user, 'user.id:', req.auth?.user?.id, 'user.email:', req.auth?.user?.email, 'user.role:', req.auth?.user?.role);
            if (hasAuthCookies && !req.auth) {
                console.log('[Middleware] ⚠️ Cookies présents mais req.auth est undefined - cookies:', {
                    'next-auth.session-token': req.cookies.has('next-auth.session-token'),
                    '__Secure-next-auth.session-token': req.cookies.has('__Secure-next-auth.session-token'),
                    'authjs.session-token': req.cookies.has('authjs.session-token'),
                });
            }
        }
    }
    
    // Si des cookies existent mais req.auth n'est pas valide, les supprimer
    // MAIS seulement si on n'est pas sur une route d'authentification (pour éviter de supprimer les cookies pendant la connexion)
    // Et seulement si on n'est pas sur une route publique (pour éviter de supprimer les cookies sur les pages publiques)
    // Ne supprimer les cookies que si on est sûr qu'ils sont invalides (pas de req.auth du tout)
        if (hasAuthCookies && !req.auth && !isAuthRoute && !isPublicRouteCheck) {
            const response = NextResponse.next();
            response.cookies.set('next-auth.session-token', '', { expires: new Date(0), path: '/' });
            response.cookies.set('__Secure-next-auth.session-token', '', { expires: new Date(0), path: '/' });
            response.cookies.set('next-auth.csrf-token', '', { expires: new Date(0), path: '/' });
            response.cookies.set('authjs.session-token', '', { expires: new Date(0), path: '/' });
            response.cookies.set('authjs.csrf-token', '', { expires: new Date(0), path: '/' });
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
        const rateLimitResult = checkRateLimit(identifier, preset);
        
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
            const response = Response.redirect(new URL(DEFAULT_LOGIN_REDIRECT, nextUrl));
            return addSecurityHeaders(response as NextResponse, req);
        }
        
        // Sinon, laisser passer pour permettre l'accès à la page de connexion
        // Même si req.auth existe partiellement, si user.id n'existe pas, on considère la session invalide
        const response = NextResponse.next();
        return addSecurityHeaders(response, req);
    }

    // Pour les routes admin, vérifier aussi le rôle
    const isAdminRoute = nextUrl.pathname.startsWith('/admin');
    if (isAdminRoute && isLoggedIn) {
        const userRole = req.auth?.user?.role;
        if (userRole !== 'Admin') {
            // L'utilisateur est connecté mais n'est pas admin, rediriger vers la page d'accueil
            const response = Response.redirect(new URL('/', nextUrl));
            return addSecurityHeaders(response as NextResponse, req);
        }
    }

    if (!isLoggedIn && !isPublicRouteCheck) {
        let callbackUrl = nextUrl.pathname;
        if (nextUrl.search) {
            callbackUrl += nextUrl.search;
        }

        const encodedCallbackUrl = encodeURIComponent(callbackUrl);
        const response = Response.redirect(new URL(
            `/auth/sign-in?callbackUrl=${encodedCallbackUrl}`, nextUrl));
        return addSecurityHeaders(response as NextResponse, req);
    }

    const response = NextResponse.next();
    return addSecurityHeaders(response, req);
});

export const config = {
    matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
}