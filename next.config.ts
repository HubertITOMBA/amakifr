import type { NextConfig } from "next";

/**
 * Nettoie une URL en supprimant les guillemets, points-virgules et espaces
 * (Copie locale pour éviter les dépendances circulaires)
 */
function cleanUrl(url: string | undefined | null): string | undefined {
  if (!url || url === '') return undefined;
  return url.trim()
    .replace(/^["']|["']$/g, '')
    .replace(/;+$/, '')
    .trim();
}

// Configuration PWA
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development', // Désactiver en développement pour éviter les problèmes
  buildExcludes: [/app-build-manifest\.json$/],
  fallbacks: {
    document: '/offline',
  },
  runtimeCaching: [
    // Cache des pages HTML avec stratégie NetworkFirst
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages-cache',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 24 * 60 * 60, // 24 heures
        },
        networkTimeoutSeconds: 3,
      },
    },
    // Cache des images avec stratégie CacheFirst
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'images-cache',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 jours
        },
      },
    },
    // Cache des fichiers statiques (CSS, JS, fonts)
    {
      urlPattern: /\.(?:js|css|woff|woff2|ttf|eot)$/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-resources',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 jours
        },
      },
    },
    // Cache des API avec stratégie NetworkFirst
    {
      urlPattern: /\/api\/.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 5 * 60, // 5 minutes
        },
        networkTimeoutSeconds: 3,
      },
    },
  ],
});

const nextConfig: NextConfig = {
  /* config options here */

  eslint: {
    // XXX Warning: This allows production builds to successfully complete even if
    // XXX your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // En développement, forcer l'utilisation de HTTP et éviter 0.0.0.0
  // Le navigateur ne peut pas accéder à 0.0.0.0, il doit utiliser localhost ou l'IP réseau
  ...(process.env.NODE_ENV === 'development' && {
    // Désactiver la génération d'URLs absolues pour les assets en développement
    // Cela permet au navigateur d'utiliser l'URL relative depuis laquelle la page a été chargée
    assetPrefix: undefined,
  }),


  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '**.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '**.cloudfront.net',
      },
      {
        protocol: 'https',
        hostname: '**.googleusercontent.com',
      },
    ],
    // domains supprimé car deprecated
  },

  // Augmenter la limite de taille pour les Server Actions (pour l'upload de vidéos jusqu'à 5GB)
  // Cette limite correspond à la configuration nginx (client_max_body_size 5G)
  // Note: Pour les routes API, Next.js limite le body à 10MB côté client.
  // C'est pourquoi nous utilisons l'upload par chunks pour contourner cette limite.
  experimental: {
    serverActions: {
      bodySizeLimit: '5gb',
      // Améliorer la stabilité des Server Actions en production
      // En développement, permettre toutes les origines pour faciliter l'accès réseau
      allowedOrigins: process.env.NODE_ENV === 'production' 
        ? [cleanUrl(process.env.NEXT_PUBLIC_APP_URL) || 'https://amaki.fr'].filter(Boolean)
        : ['*'], // Permettre toutes les origines en développement pour l'accès réseau
    },
  },

  // Rewrite pour servir les fichiers statiques uploadés via l'API
  // En production, les fichiers dans /public/ressources/* ne sont pas servis automatiquement
  // Cette configuration redirige /ressources/* vers /api/ressources/* qui sert les fichiers
  async rewrites() {
    return [
      {
        source: '/ressources/:path*',
        destination: '/api/ressources/:path*',
      },
    ];
  },

};

export default withPWA(nextConfig);
