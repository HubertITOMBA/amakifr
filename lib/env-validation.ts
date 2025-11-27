/**
 * Validation des variables d'environnement au démarrage de l'application
 * Assure que toutes les variables critiques sont présentes et valides
 */

import { z } from 'zod';

// Fonction helper pour transformer les chaînes vides en undefined
const emptyStringToUndefined = z.preprocess(
  (val) => (val === '' ? undefined : val),
  z.string().optional()
);

// Fonction helper pour valider une URL optionnelle
// Si la valeur est vide ou undefined, retourner undefined
// Sinon, valider comme URL
const optionalUrl = z.preprocess(
  (val) => {
    if (val === '' || val === undefined || val === null) {
      return undefined;
    }
    return val;
  },
  z.union([
    z.string().url(),
    z.undefined(),
  ]).optional()
);

// Schéma de base (sans validation stricte de AUTH_SECRET)
const baseEnvSchema = z.object({
  // Base de données
  DATABASE_URL: z.string().url('DATABASE_URL doit être une URL valide'),
  
  // NextAuth - validation conditionnelle dans validateEnv()
  AUTH_SECRET: z.string().optional(),
  AUTH_URL: optionalUrl,
  
  // Google OAuth (optionnel)
  GOOGLE_CLIENT_ID: emptyStringToUndefined,
  GOOGLE_CLIENT_SECRET: emptyStringToUndefined,
  
  // Email Provider
  EMAIL_PROVIDER: z.enum(['resend', 'smtp', 'sendgrid']).optional().default('resend'),
  
  // Email (Resend) - requis si EMAIL_PROVIDER=resend
  RESEND_API_KEY: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string()
      .refine(
        (val) => !val || val.startsWith('re_'),
        { message: 'RESEND_API_KEY doit commencer par "re_"' }
      )
      .optional()
  ),
  
  // Email (SMTP) - requis si EMAIL_PROVIDER=smtp
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  
  // Email (SendGrid) - requis si EMAIL_PROVIDER=sendgrid
  SENDGRID_API_KEY: z.string().optional(),
  SENDGRID_FROM: z.string().optional(),
  
  // Application
  NEXT_PUBLIC_APP_URL: z.string().url('NEXT_PUBLIC_APP_URL doit être une URL valide'),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).optional(),
  NEXT_PUBLIC_APP_DESCRIPTION: z.string().optional(),
  // NEXT_PUBLIC_SERVER_URL est vraiment optionnel
  NEXT_PUBLIC_SERVER_URL: z.preprocess(
    (val) => {
      if (!val || val === '') return undefined;
      try {
        new URL(val);
        return val;
      } catch {
        return undefined; // Si l'URL est invalide, retourner undefined
      }
    },
    z.string().url().optional()
  ),
  
  // Payment Provider
  PAYMENT_PROVIDER: z.enum(['stripe', 'paypal', 'virement']).optional().default('stripe'),
  
  // Stripe (optionnel mais requis si PAYMENT_PROVIDER=stripe)
  STRIPE_SECRET_KEY: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string()
      .refine(
        (val) => !val || val.startsWith('sk_'),
        { message: 'STRIPE_SECRET_KEY doit commencer par "sk_"' }
      )
      .optional()
  ),
  STRIPE_WEBHOOK_SECRET: emptyStringToUndefined,
  
  // PayPal (optionnel mais requis si PAYMENT_PROVIDER=paypal)
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  PAYPAL_MODE: z.enum(['sandbox', 'live']).optional().default('sandbox'),
  
  // Node.js
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

// Type pour les variables d'environnement validées
export type Env = z.infer<typeof baseEnvSchema>;

/**
 * Valide et retourne les variables d'environnement
 * En développement : affiche des warnings mais ne bloque pas
 * En production : lance une erreur si des variables critiques sont manquantes ou invalides
 */
function validateEnv(): Env {
  // Préprocesser les valeurs pour convertir les chaînes vides en undefined
  const processedEnv = Object.fromEntries(
    Object.entries(process.env).map(([key, value]) => [
      key,
      value === '' ? undefined : value,
    ])
  );
  
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Valider avec le schéma de base
  const result = baseEnvSchema.safeParse(processedEnv);
  
  if (!result.success) {
    const errors = result.error.errors.map(err => ({
      path: err.path.join('.'),
      message: err.message,
    }));
    
    if (isDevelopment) {
      // En développement : afficher des warnings mais continuer
      console.warn('⚠️  Avertissements de validation des variables d\'environnement:');
      errors.forEach(({ path, message }) => {
        console.warn(`  - ${path}: ${message}`);
      });
      console.warn('⚠️  L\'application continue en mode développement, mais certaines fonctionnalités peuvent ne pas fonctionner.');
      console.warn('⚠️  Assurez-vous de configurer correctement toutes les variables avant la production.\n');
      
      // Retourner les valeurs avec des valeurs par défaut pour permettre le démarrage
      const defaultValues: Partial<Env> = {
        AUTH_SECRET: processedEnv.AUTH_SECRET || 'dev-secret-minimum-16-chars-for-development-only',
        DATABASE_URL: processedEnv.DATABASE_URL || 'postgresql://localhost:5432/amakifr',
        NEXT_PUBLIC_APP_URL: processedEnv.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        NODE_ENV: 'development' as const,
      };
      
      return {
        ...defaultValues,
        ...processedEnv,
        ...defaultValues,
      } as Env;
    } else {
      // En production : bloquer le démarrage
      console.error('❌ Erreur de validation des variables d\'environnement:');
      errors.forEach(({ path, message }) => {
        console.error(`  - ${path}: ${message}`);
      });
      
      throw new Error(
        `Variables d'environnement invalides ou manquantes. Vérifiez votre fichier .env\n` +
        `Erreurs: ${JSON.stringify(errors, null, 2)}`
      );
    }
  }
  
  const validated = result.data;
  
  // Validation supplémentaire de AUTH_SECRET selon l'environnement
  if (!isDevelopment && validated.AUTH_SECRET) {
    if (validated.AUTH_SECRET.length < 16) {
      throw new Error(
        'AUTH_SECRET doit contenir au moins 16 caractères en production (32 recommandés). ' +
        'Générez-en un avec: openssl rand -base64 32'
      );
    }
  }
  
  // S'assurer qu'AUTH_SECRET existe (avec valeur par défaut en développement si nécessaire)
  if (!validated.AUTH_SECRET) {
    if (isDevelopment) {
      validated.AUTH_SECRET = 'dev-secret-minimum-16-chars-for-development-only';
    } else {
      throw new Error(
        'AUTH_SECRET est requis en production. Générez-en un avec: openssl rand -base64 32'
      );
    }
  }
  
  return validated;
}

// Valider les variables d'environnement au chargement du module
export const env = validateEnv();

/**
 * Vérifie si une fonctionnalité est activée
 */
export const isFeatureEnabled = {
  googleOAuth: () => !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  stripe: () => !!(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET),
  resend: () => !!env.RESEND_API_KEY,
} as const;

