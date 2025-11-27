"use server";

/**
 * Server Action pour récupérer la liste des pays depuis la base de données locale
 * Utilise les données importées dans la table Country (Carto/REST Countries)
 * Fallback sur GeonamesCountry si Country est vide
 */

import { db } from "@/lib/db";

export interface CountryResult {
  value: string;
  label: string;
  code: string;
}

/**
 * Récupère la liste de tous les pays depuis la base de données locale
 * 
 * @param searchTerm Terme de recherche optionnel pour filtrer les pays
 * @returns Liste des pays avec leurs noms et codes
 */
export async function getCountries(
  searchTerm?: string
): Promise<{ success: boolean; countries?: CountryResult[]; error?: string }> {
  try {
    // Vérifier d'abord si la table Country contient des données
    const countryCount = await db.country.count();
    
    if (countryCount > 0) {
      // Utiliser la table Country (Carto/REST Countries)
      const where: any = {};

      // Si un terme de recherche est fourni, filtrer
      if (searchTerm && searchTerm.trim().length > 0) {
        where.OR = [
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
            code: {
              equals: searchTerm.toUpperCase(),
            },
          },
        ];
      }

      const countries = await db.country.findMany({
        where,
        orderBy: {
          nameFr: 'asc',
        },
        select: {
          name: true,
          nameFr: true,
          code: true,
        },
      });

      const formattedCountries: CountryResult[] = countries.map((country) => ({
        value: country.nameFr || country.name,
        label: country.nameFr || country.name,
        code: country.code,
      }));

      return { success: true, countries: formattedCountries };
    } else {
      // Fallback sur GeonamesCountry si Country est vide
      const where: any = {};

      if (searchTerm && searchTerm.trim().length > 0) {
        where.OR = [
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
          {
            countryCode: {
              equals: searchTerm.toUpperCase(),
            },
          },
        ];
      }

      const countries = await db.geonamesCountry.findMany({
        where,
        orderBy: {
          name: 'asc',
        },
        select: {
          name: true,
          countryCode: true,
        },
      });

      const formattedCountries: CountryResult[] = countries.map((country) => ({
        value: country.name,
        label: country.name,
        code: country.countryCode,
      }));

      return { success: true, countries: formattedCountries };
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des pays:', error);
    
    // Fallback sur une liste de base en cas d'erreur
    const fallbackCountries: CountryResult[] = [
      { value: 'France', label: 'France', code: 'FR' },
      { value: 'Belgique', label: 'Belgique', code: 'BE' },
      { value: 'Suisse', label: 'Suisse', code: 'CH' },
      { value: 'Canada', label: 'Canada', code: 'CA' },
      { value: 'Congo', label: 'Congo', code: 'CG' },
      { value: 'RDC', label: 'RDC', code: 'CD' },
    ];

    return { success: true, countries: fallbackCountries };
  }
}

