/**
 * Utilitaires pour les headers de sécurité HTTP
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Vérifie si la requête utilise HTTPS (directement ou via un reverse proxy)
 * 
 * IMPORTANT : Ne se fie QUE aux headers du reverse proxy, pas à l'URL de la requête
 * car l'URL peut être trompeuse (ex: URL absolue avec https:// même si le serveur est en HTTP)
 */
function isHttps(request: NextRequest | null): boolean {
  if (!request) return false;
  
  // PRIORITÉ 1 : Vérifier le header X-Forwarded-Proto (utilisé par les reverse proxies comme nginx)
  // C'est le moyen le plus fiable car il est défini par le reverse proxy qui connaît le protocole réel
  const forwardedProto = request.headers.get('x-forwarded-proto');
  if (forwardedProto === 'https') return true;
  
  // PRIORITÉ 2 : Vérifier le header X-Forwarded-Ssl
  const forwardedSsl = request.headers.get('x-forwarded-ssl');
  if (forwardedSsl === 'on') return true;
  
  // PRIORITÉ 3 : Vérifier le header Forwarded (standard RFC 7239)
  // Format: Forwarded: proto=https
  const forwarded = request.headers.get('forwarded');
  if (forwarded) {
    const protoMatch = forwarded.match(/proto=([^;,\s]+)/i);
    if (protoMatch && protoMatch[1] === 'https') return true;
  }
  
  // NE PAS vérifier l'URL de la requête car elle peut être trompeuse :
  // - L'URL peut contenir https:// même si le serveur tourne en HTTP
  // - L'URL peut être une URL absolue construite côté client
  // - En cas d'accès direct au serveur Next.js (sans reverse proxy), l'URL sera toujours http://
  
  return false;
}

/**
 * Ajoute les headers de sécurité à une réponse
 * Dans Next.js 15, les headers sont immutables, donc on doit créer une nouvelle réponse
 */
export function addSecurityHeaders(
  response: NextResponse,
  request?: NextRequest | null
): NextResponse {
  // Vérifier si la réponse a déjà été envoyée (headers immutables)
  // Si les headers sont déjà verrouillés, retourner la réponse telle quelle
  try {
    // Tester si on peut lire les headers (si la réponse est déjà envoyée, cela échouera)
    response.headers.get('content-type');
  } catch (error) {
    // Si on ne peut pas accéder aux headers, la réponse est déjà envoyée
    // Retourner la réponse telle quelle sans modification
    return response;
  }
  
  // Créer un nouvel objet Headers à partir des headers existants
  const headers = new Headers(response.headers);
  
  // Protection contre le MIME type sniffing
  headers.set('X-Content-Type-Options', 'nosniff');
  
  // Protection contre le clickjacking
  headers.set('X-Frame-Options', 'DENY');
  
  // Protection XSS (legacy mais toujours utile)
  headers.set('X-XSS-Protection', '1; mode=block');
  
  // Politique de referrer
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy
  // En développement, désactiver complètement la CSP pour éviter les problèmes avec HTTP
  // En production, vérifier si HTTPS est réellement utilisé avant d'activer upgrade-insecure-requests
  if (process.env.NODE_ENV === 'production') {
    const useHttps = isHttps(request || null);
    
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:" + (useHttps ? '' : ' http:'),
      "font-src 'self' data:",
      "connect-src 'self' https://api.stripe.com https://*.stripe.com" + (useHttps ? '' : ' http:'),
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      // Ne forcer HTTPS que si le serveur supporte réellement HTTPS
      ...(useHttps ? ["upgrade-insecure-requests"] : []),
    ].join('; ');
    
    headers.set('Content-Security-Policy', csp);
  }
  // En développement, ne pas définir de CSP pour éviter les problèmes avec HTTP
  
  // Strict Transport Security (HSTS) - seulement en production avec HTTPS réel
  if (process.env.NODE_ENV === 'production' && isHttps(request || null)) {
    headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }
  
  // Permissions Policy (anciennement Feature Policy)
  const permissionsPolicy = [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'interest-cohort=()',
  ].join(', ');
  
  headers.set('Permissions-Policy', permissionsPolicy);
  
  // Créer une nouvelle réponse avec les headers modifiés
  // Pour NextResponse.next(), le body peut être null, donc on utilise response.body ?? null
  // Pour les redirections, on préserve le body s'il existe
  try {
    const newResponse = new NextResponse(response.body ?? null, {
      status: response.status,
      statusText: response.statusText,
      headers: headers,
    });
    
    return newResponse;
  } catch (error) {
    // Si une erreur se produit lors de la création de la réponse
    // (par exemple, si les headers sont déjà envoyés), retourner la réponse originale
    console.error('Erreur lors de l\'ajout des headers de sécurité:', error);
    return response;
  }
}

/**
 * Middleware helper pour ajouter les headers de sécurité
 */
export function withSecurityHeaders(
  request: NextRequest,
  handler: (request: NextRequest) => NextResponse | Promise<NextResponse>
): Promise<NextResponse> {
  return Promise.resolve(handler(request)).then((response) => addSecurityHeaders(response, request));
}

