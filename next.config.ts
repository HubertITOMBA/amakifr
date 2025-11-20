import type { NextConfig } from "next";

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

  // Augmenter la limite de taille pour les Server Actions (pour l'upload d'images)
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },

};

export default withPWA(nextConfig);
