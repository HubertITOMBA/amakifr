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
