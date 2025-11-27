/**
 * API pour récupérer la liste des villes
 * Utilise Geonames API (gratuite avec compte gratuit)
 * Alternative: API de villes française pour la France
 */

export interface City {
  name: string;
  countryCode: string;
  adminCode1?: string; // Code région/département
  adminName1?: string; // Nom région/département
}

/**
 * Récupère les villes d'un pays donné
 * Utilise Geonames API (nécessite une clé API gratuite)
 * Pour la production, configurez GEONAMES_USERNAME dans .env
 * 
 * @param countryCode Code pays ISO 2 lettres (ex: 'FR')
 * @param searchTerm Terme de recherche pour filtrer les villes
 * @returns Liste des villes
 */
export async function getCities(
  countryCode: string,
  searchTerm: string = ''
): Promise<Array<{ value: string; label: string }>> {
  if (!countryCode) {
    return [];
  }

  // Si pas de terme de recherche, retourner une liste vide
  // (pour éviter de charger toutes les villes)
  if (!searchTerm || searchTerm.length < 2) {
    return [];
  }

  try {
    const username = process.env.NEXT_PUBLIC_GEONAMES_USERNAME || 'demo';
    
    // Utiliser l'API Geonames pour rechercher des villes
    // Utiliser fetch côté client
    const response = await fetch(
      `https://secure.geonames.org/searchJSON?q=${encodeURIComponent(searchTerm)}&country=${countryCode}&maxRows=20&username=${username}&style=SHORT`,
      {
        cache: 'no-store', // Pas de cache pour les recherches dynamiques
      }
    );

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des villes');
    }

    const data = await response.json();

    if (!data.geonames || data.geonames.length === 0) {
      return [];
    }

    // Formater les résultats
    const cities = data.geonames.map((city: any) => ({
      value: city.name,
      label: city.adminName1 
        ? `${city.name}, ${city.adminName1}` 
        : city.name,
    }));

    // Supprimer les doublons
    const uniqueCities = Array.from(
      new Map(cities.map(city => [city.value, city])).values()
    );

    return uniqueCities;
  } catch (error) {
    console.error('Erreur lors de la récupération des villes:', error);
    
    // Pour la France, retourner une liste de base de grandes villes
    if (countryCode === 'FR' && searchTerm.length >= 2) {
      const frenchCities = [
        'Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Nantes',
        'Strasbourg', 'Montpellier', 'Bordeaux', 'Lille', 'Rennes',
        'Reims', 'Saint-Étienne', 'Toulon', 'Le Havre', 'Grenoble',
        'Dijon', 'Angers', 'Nîmes', 'Villeurbanne', 'Saint-Denis',
        'Le Mans', 'Aix-en-Provence', 'Clermont-Ferrand', 'Brest',
      ].filter(city => 
        city.toLowerCase().includes(searchTerm.toLowerCase())
      ).map(city => ({
        value: city,
        label: city,
      }));

      return frenchCities.slice(0, 20);
    }

    return [];
  }
}

/**
 * Liste de base de grandes villes françaises (fallback)
 */
export const FRENCH_MAJOR_CITIES = [
  'Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Nantes',
  'Strasbourg', 'Montpellier', 'Bordeaux', 'Lille', 'Rennes',
  'Reims', 'Saint-Étienne', 'Toulon', 'Le Havre', 'Grenoble',
  'Dijon', 'Angers', 'Nîmes', 'Villeurbanne', 'Saint-Denis',
  'Le Mans', 'Aix-en-Provence', 'Clermont-Ferrand', 'Brest',
].map(city => ({
  value: city,
  label: city,
}));

