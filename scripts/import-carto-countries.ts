/**
 * Script pour importer les pays depuis une source de données locale
 * 
 * Ce script :
 * 1. Utilise une liste de pays statique (basée sur ISO 3166-1)
 * 2. Formate et importe les données dans la table Country
 * 
 * Usage: npm run db:import-carto-countries
 * 
 * Note: Pour une liste complète et à jour, on utilise une liste statique
 * basée sur les codes ISO standard, avec les noms français.
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Charger la liste des pays depuis le fichier JSON
const COUNTRIES_DATA_PATH = path.join(process.cwd(), 'data', 'countries-iso.json');

interface CountryData {
  code: string;
  code3: string;
  name: string;
  nameFr: string;
  region: string;
  subregion: string | null;
}

interface RestCountry {
  name: {
    common: string;
    official: string;
    nativeName?: {
      [key: string]: {
        official: string;
        common: string;
      };
    };
  };
  cca2: string; // Code ISO 2 lettres
  cca3: string; // Code ISO 3 lettres
  capital?: string[];
  region: string;
  subregion?: string;
  latlng?: [number, number]; // [latitude, longitude]
  population: number;
  area: number;
  currencies?: {
    [key: string]: {
      name: string;
      symbol: string;
    };
  };
  languages?: {
    [key: string]: string;
  };
  timezones?: string[];
  flags: {
    png: string;
    svg: string;
  };
}

/**
 * Charge les pays depuis le fichier JSON local
 */
function loadCountriesFromFile(): CountryData[] {
  console.log('📥 Chargement des pays depuis le fichier JSON local...');
  
  try {
    if (!fs.existsSync(COUNTRIES_DATA_PATH)) {
      throw new Error(`Le fichier ${COUNTRIES_DATA_PATH} n'existe pas`);
    }

    const fileContent = fs.readFileSync(COUNTRIES_DATA_PATH, 'utf-8');
    const countries: CountryData[] = JSON.parse(fileContent);
    
    if (!Array.isArray(countries)) {
      throw new Error('Le fichier JSON ne contient pas un tableau');
    }
    
    console.log(`✅ ${countries.length} pays chargés\n`);
    
    return countries;
  } catch (error) {
    console.error('❌ Erreur lors du chargement des pays:', error);
    throw error;
  }
}

/**
 * Formate un pays pour l'insertion en base
 */
function formatCountry(country: CountryData): any {
  return {
    name: country.name,
    nameEn: country.name,
    nameFr: country.nameFr,
    code: country.code,
    code3: country.code3,
    capital: null, // Pas disponible dans la liste ISO de base
    region: country.region || null,
    subregion: country.subregion || null,
    latitude: null, // Pas disponible dans la liste ISO de base
    longitude: null, // Pas disponible dans la liste ISO de base
    population: null, // Pas disponible dans la liste ISO de base
    area: null, // Pas disponible dans la liste ISO de base
    currency: null, // Pas disponible dans la liste ISO de base
    currencyName: null, // Pas disponible dans la liste ISO de base
    languages: null, // Pas disponible dans la liste ISO de base
    timezones: null, // Pas disponible dans la liste ISO de base
    flag: null, // Pas disponible dans la liste ISO de base
    source: 'iso-3166',
    externalId: country.code,
    metadata: JSON.stringify({
      code3: country.code3,
    }),
  };
}

/**
 * Importe les pays dans la base de données
 */
async function importCountries(batchSize: number = 50): Promise<void> {
  console.log('📊 Import des pays dans la base de données...\n');

  try {
    // Charger les pays depuis le fichier JSON
    const countries = loadCountriesFromFile();

    // Formater les pays
    const formattedCountries = countries.map(formatCountry);

    // Importer par batch
    let importedCount = 0;
    for (let i = 0; i < formattedCountries.length; i += batchSize) {
      const batch = formattedCountries.slice(i, i + batchSize);
      
      try {
        await prisma.country.createMany({
          data: batch,
          skipDuplicates: true,
        });
        importedCount += batch.length;
        process.stdout.write(`\r📊 Importé: ${importedCount}/${formattedCountries.length} pays`);
      } catch (error) {
        console.error(`\n❌ Erreur lors de l'import du batch ${i}-${i + batchSize}:`, error);
      }
    }

    console.log(`\n✅ Import terminé: ${importedCount} pays importés`);
  } catch (error) {
    console.error('❌ Erreur lors de l\'import:', error);
    throw error;
  }
}

/**
 * Fonction principale
 */
async function main() {
  console.log('🌍 Import des pays depuis la liste ISO 3166-1\n');
  console.log('='.repeat(60));
  console.log('ℹ️  Note: Liste basée sur le standard ISO 3166-1 avec noms français');
  console.log('='.repeat(60));
  console.log('');
  
  try {
    // Vider la table avant import (optionnel)
    console.log('🗑️  Nettoyage de la table existante...');
    await prisma.country.deleteMany({});
    console.log('✅ Table nettoyée\n');

    // Importer les pays
    await importCountries();

    console.log('\n🎉 Import terminé avec succès !');
    console.log('\n📋 Statistiques:');
    const totalCountries = await prisma.country.count();
    const countriesByRegion = await prisma.country.groupBy({
      by: ['region'],
      _count: true,
      orderBy: {
        _count: {
          region: 'desc',
        },
      },
    });
    
    console.log(`   Total de pays: ${totalCountries}`);
    console.log('\n   Par région:');
    countriesByRegion.forEach((item) => {
      if (item.region) {
        console.log(`   - ${item.region}: ${item._count} pays`);
      }
    });

    // Afficher quelques exemples
    const sampleCountries = await prisma.country.findMany({
      take: 5,
      orderBy: {
        name: 'asc',
      },
      select: {
        name: true,
        nameFr: true,
        code: true,
        capital: true,
      },
    });

    console.log('\n   Exemples de pays importés:');
    sampleCountries.forEach((country) => {
      console.log(`   - ${country.nameFr || country.name} (${country.code}) - Capitale: ${country.capital || 'N/A'}`);
    });

  } catch (error) {
    console.error('\n💥 Erreur:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
main();

