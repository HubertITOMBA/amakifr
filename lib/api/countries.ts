/**
 * API pour récupérer la liste des pays
 * Utilise les données Geonames stockées localement dans la base de données
 */

import { getCountries as getCountriesFromDB } from "@/actions/location/get-countries";
import { normalizeString } from "@/lib/utils";

export interface Country {
  name: {
    common: string;
    official: string;
  };
  cca2: string; // Code pays ISO 2 lettres
  cca3: string; // Code pays ISO 3 lettres
}

/**
 * Récupère la liste de tous les pays depuis la base de données locale
 * @returns Liste des pays avec leurs noms et codes
 */
export async function getCountries(): Promise<Array<{ value: string; label: string; code: string }>> {
  try {
    const result = await getCountriesFromDB();
    
    if (result.success && result.countries) {
      return result.countries;
    }

    // Fallback en cas d'erreur
    throw new Error(result.error || 'Erreur lors de la récupération des pays');
  } catch (error) {
    console.error('Erreur lors de la récupération des pays:', error);
    // Retourner une liste de base en cas d'erreur
    return [
      { value: 'France', label: 'France', code: 'FR' },
      { value: 'Belgique', label: 'Belgique', code: 'BE' },
      { value: 'Suisse', label: 'Suisse', code: 'CH' },
      { value: 'Canada', label: 'Canada', code: 'CA' },
      { value: 'Congo', label: 'Congo', code: 'CG' },
      { value: 'RDC', label: 'RDC', code: 'CD' },
    ];
  }
}

/**
 * Recherche de pays par nom (côté client)
 * Insensible à la casse et aux accents
 * @param countries Liste des pays
 * @param searchTerm Terme de recherche
 * @returns Pays filtrés
 */
export function searchCountries(
  countries: Array<{ value: string; label: string; code: string }>,
  searchTerm: string
): Array<{ value: string; label: string; code: string }> {
  if (!searchTerm) return countries;
  
  const termNormalized = normalizeString(searchTerm.trim());
  return countries.filter(country =>
    normalizeString(country.label).includes(termNormalized) ||
    normalizeString(country.code).includes(termNormalized)
  );
}

