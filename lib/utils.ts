import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalise une chaîne de caractères en supprimant les accents et diacritiques
 * Utile pour les recherches insensibles aux accents
 * 
 * @param str - La chaîne à normaliser
 * @returns La chaîne normalisée sans accents (en minuscules)
 * 
 * @example
 * normalizeString("États-Unis") // "etats-unis"
 * normalizeString("Érythrée") // "erythree"
 */
export function normalizeString(str: string): string {
  return str
    .normalize("NFD") // Décompose les caractères accentués
    .replace(/[\u0300-\u036f]/g, "") // Supprime les diacritiques
    .toLowerCase();
}

/**
 * Nettoie une URL en supprimant les guillemets, points-virgules et espaces
 * Utile pour nettoyer les variables d'environnement qui pourraient contenir des caractères indésirables
 * 
 * @param url - L'URL à nettoyer
 * @returns L'URL nettoyée ou undefined si l'URL est vide
 * 
 * @example
 * cleanUrl('"https://www.amaki.fr";') // "https://www.amaki.fr"
 * cleanUrl('  https://amaki.fr  ') // "https://amaki.fr"
 */
export function cleanUrl(url: string | undefined | null): string | undefined {
  if (!url || url === '') return undefined;
  return url.trim()
    .replace(/^["']|["']$/g, '')
    .replace(/;+$/, '')
    .trim();
}

/**
 * Vérifie si un rôle utilisateur est un rôle admin autorisé
 * 
 * @param role - Le rôle à vérifier (peut être string, UserRole, ou null/undefined)
 * @returns true si le rôle est un rôle admin autorisé
 */
export function isAdminRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const adminRoles = ['ADMIN', 'PRESID', 'VICEPR', 'SECRET', 'VICESE', 'COMCPT', 'TRESOR', 'VTRESO'];
  const normalizedRole = role.toString().trim().toUpperCase();
  return adminRoles.includes(normalizedRole);
}

/**
 * Normalise un email en minuscules et supprime les espaces
 * Assure l'unicité case-insensitive des emails dans la base de données
 * 
 * @param email - L'email à normaliser
 * @returns L'email normalisé en minuscules et sans espaces
 * 
 * @example
 * normalizeEmail('  Matumonamusanda@yahoo.fr  ') // "matumonamusanda@yahoo.fr"
 * normalizeEmail('Matumonamusanda@yahoo.fr') // "matumonamusanda@yahoo.fr"
 */
export function normalizeEmail(email: string | null | undefined): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

/**
 * Vérifie si une erreur est une erreur d'autorisation
 * Les erreurs d'autorisation ne doivent pas afficher de toast à l'utilisateur
 * car cela signifie simplement qu'il n'a pas accès à cette fonctionnalité
 * 
 * @param error - Le message d'erreur à vérifier
 * @returns true si c'est une erreur d'autorisation, false sinon
 * 
 * @example
 * isAuthorizationError("Non autorisé") // true
 * isAuthorizationError("Admin requis") // true
 * isAuthorizationError("Erreur de connexion") // false
 */
export function isAuthorizationError(error: string | null | undefined): boolean {
  if (!error) return false;
  const normalizedError = error.toLowerCase();
  return (
    normalizedError.includes("non autorisé") ||
    normalizedError.includes("non autorise") ||
    normalizedError.includes("admin requis") ||
    normalizedError.includes("permission") ||
    normalizedError.includes("accès refusé") ||
    normalizedError.includes("acces refuse")
  );
}
