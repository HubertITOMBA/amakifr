"use server";

/**
 * Server Action pour récupérer les villes d'un pays depuis la base de données locale
 * Utilise les données importées dans la table City (Carto/API Gouv/Nominatim)
 * Fallback sur GeonamesCity si City est vide
 */

import { db } from "@/lib/db";

export interface CityResult {
  value: string;
  label: string;
}

/**
 * Récupère les villes d'un pays donné depuis la base de données locale
 * 
 * @param countryCode Code pays ISO 2 lettres (ex: 'FR')
 * @param searchTerm Terme de recherche pour filtrer les villes (min. 2 caractères)
 * @returns Liste des villes correspondantes
 */
export async function getCitiesByCountry(
  countryCode: string,
  searchTerm: string
): Promise<{ success: boolean; cities?: CityResult[]; error?: string }> {
  if (!countryCode) {
    return { success: false, error: "Code pays requis" };
  }

  if (!searchTerm || searchTerm.length < 2) {
    return { success: true, cities: [] };
  }

  try {
    // Vérifier d'abord si la table City contient des données
    const cityCount = await db.city.count({
      where: {
        countryCode: countryCode.toUpperCase(),
      },
    });

    if (cityCount > 0) {
      // Utiliser la table City (Carto/API Gouv/Nominatim)
      const cities = await db.city.findMany({
        where: {
          countryCode: countryCode.toUpperCase(),
          OR: [
            {
              name: {
                contains: searchTerm,
                mode: 'insensitive',
              },
            },
            {
              nameFr: {
                contains: searchTerm,
                mode: 'insensitive',
              },
            },
            {
              nameEn: {
                contains: searchTerm,
                mode: 'insensitive',
              },
            },
            {
              postalCode: {
                contains: searchTerm,
                mode: 'insensitive',
              },
            },
          ],
        },
        orderBy: [
          {
            population: 'desc',
          },
          {
            isMajor: 'desc',
          },
          {
            name: 'asc',
          },
        ],
        take: 20,
        select: {
          name: true,
          nameFr: true,
          region: true,
          department: true,
          postalCode: true,
        },
      });

      const formattedCities: CityResult[] = cities.map((city) => {
        const cityName = city.nameFr || city.name;
        const parts = [cityName];
        
        if (city.department) {
          parts.push(city.department);
        } else if (city.region) {
          parts.push(city.region);
        }
        
        return {
          value: cityName,
          label: parts.join(', '),
        };
      });

      const uniqueCities = Array.from(
        new Map(formattedCities.map(city => [city.value, city])).values()
      );

      return { success: true, cities: uniqueCities };
    } else {
      // Fallback sur GeonamesCity si City est vide
      const cities = await db.geonamesCity.findMany({
        where: {
          countryCode: countryCode.toUpperCase(),
          OR: [
            {
              name: {
                contains: searchTerm,
                mode: 'insensitive',
              },
            },
            {
              asciiName: {
                contains: searchTerm,
                mode: 'insensitive',
              },
            },
          ],
        },
        orderBy: [
          {
            population: 'desc',
          },
          {
            name: 'asc',
          },
        ],
        take: 20,
        select: {
          name: true,
          admin1Code: true,
        },
      });

      const formattedCities: CityResult[] = cities.map((city) => {
        const label = city.admin1Code 
          ? `${city.name}, ${city.admin1Code}` 
          : city.name;
        
        return {
          value: city.name,
          label: label,
        };
      });

      const uniqueCities = Array.from(
        new Map(formattedCities.map(city => [city.value, city])).values()
      );

      return { success: true, cities: uniqueCities };
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des villes:', error);
    
    // Fallback pour la France
    if (countryCode === 'FR' && searchTerm.length >= 2) {
      const frenchCities: CityResult[] = [
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

      return { success: true, cities: frenchCities.slice(0, 20) };
    }

    return { success: false, error: "Erreur lors de la récupération des villes" };
  }
}

