/**
 * Script pour importer les villes depuis l'API Carto ou OpenStreetMap Nominatim
 * 
 * Ce script :
 * 1. Pour la France : utilise l'API Gouv (geo.api.gouv.fr) - gratuite, sans clé API
 * 2. Pour les autres pays : utilise OpenStreetMap Nominatim API (gratuite, sans clé API)
 * 3. Importe les données dans la table City
 * 
 * Usage: npm run db:import-carto-cities
 * 
 * Note: Pour les grandes villes françaises, on utilise l'API Gouv qui est très complète.
 * Pour les autres pays, on utilise Nominatim qui est basé sur OpenStreetMap.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// URL de l'API Gouv pour les communes françaises
const API_GOUV_COMMUNES_URL = 'https://geo.api.gouv.fr/communes';

// URL de l'API Nominatim (OpenStreetMap)
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

interface ApiGouvCommune {
  code: string; // Code INSEE
  nom: string;
  codesPostaux: string[];
  codeDepartement: string;
  codeRegion: string;
  population: number;
  centre: {
    type: string;
    coordinates: [number, number]; // [longitude, latitude]
  };
}

interface NominatimPlace {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  display_name: string;
  place_rank: number;
  category: string;
  type: string;
  importance: number;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
    country_code?: string;
    postcode?: string;
  };
}

/**
 * Récupère les communes françaises depuis l'API Gouv
 */
async function fetchFrenchCities(): Promise<ApiGouvCommune[]> {
  console.log('📥 Récupération des communes françaises depuis l\'API Gouv...');
  
  try {
    // Récupérer toutes les communes avec leurs détails
    const response = await fetch(
      `${API_GOUV_COMMUNES_URL}?fields=nom,code,codesPostaux,codeDepartement,codeRegion,population,centre&limit=50000`,
      {
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status} - ${response.statusText}`);
    }

    const communes: ApiGouvCommune[] = await response.json();
    console.log(`✅ ${communes.length} communes françaises récupérées\n`);
    
    return communes;
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des communes:', error);
    throw error;
  }
}

/**
 * Récupère les grandes villes d'un pays depuis Nominatim
 */
async function fetchCitiesForCountry(
  countryCode: string,
  limit: number = 100
): Promise<NominatimPlace[]> {
  console.log(`📥 Récupération des villes pour ${countryCode} depuis Nominatim...`);
  
  try {
    // Rechercher les villes importantes d'un pays
    const response = await fetch(
      `${NOMINATIM_URL}/search?country=${countryCode}&featuretype=city&limit=${limit}&format=json`,
      {
        headers: {
          'User-Agent': 'AMAKI-FR-Application/1.0', // Requis par Nominatim
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status} - ${response.statusText}`);
    }

    const places: NominatimPlace[] = await response.json();
    console.log(`✅ ${places.length} villes récupérées pour ${countryCode}\n`);
    
    return places;
  } catch (error) {
    console.error(`❌ Erreur lors de la récupération des villes pour ${countryCode}:`, error);
    return [];
  }
}

/**
 * Formate une commune française pour l'insertion en base
 */
function formatFrenchCity(commune: ApiGouvCommune): any {
  const [longitude, latitude] = commune.centre.coordinates;
  const postalCode = commune.codesPostaux?.[0] || null;
  const isMajor = commune.population >= 50000; // Grande ville si > 50000 habitants

  return {
    name: commune.nom,
    nameFr: commune.nom,
    countryCode: 'FR',
    region: commune.codeRegion,
    department: commune.codeDepartement,
    postalCode: postalCode,
    latitude: latitude,
    longitude: longitude,
    population: commune.population > 0 ? BigInt(commune.population) : null,
    isMajor: isMajor,
    source: 'api-gouv',
    externalId: commune.code, // Code INSEE
    metadata: JSON.stringify({
      codesPostaux: commune.codesPostaux,
      codeInsee: commune.code,
    }),
  };
}

/**
 * Formate une ville Nominatim pour l'insertion en base
 */
function formatNominatimCity(place: NominatimPlace, countryCode: string): any {
  const cityName = place.address?.city || place.address?.town || place.address?.village || place.display_name.split(',')[0];
  const isMajor = place.importance >= 0.5; // Ville importante selon Nominatim

  return {
    name: cityName,
    nameEn: cityName,
    countryCode: countryCode.toUpperCase(),
    region: place.address?.state || null,
    postalCode: place.address?.postcode || null,
    latitude: parseFloat(place.lat) || null,
    longitude: parseFloat(place.lon) || null,
    isMajor: isMajor,
    source: 'nominatim',
    externalId: place.place_id?.toString() || null,
    metadata: JSON.stringify({
      osmType: place.osm_type,
      osmId: place.osm_id,
      importance: place.importance,
      displayName: place.display_name,
    }),
  };
}

/**
 * Importe les villes françaises
 */
async function importFrenchCities(batchSize: number = 500): Promise<void> {
  console.log('🇫🇷 Import des villes françaises...\n');

  try {
    const communes = await fetchFrenchCities();
    const formattedCities = communes.map(formatFrenchCity);

    let importedCount = 0;
    for (let i = 0; i < formattedCities.length; i += batchSize) {
      const batch = formattedCities.slice(i, i + batchSize);
      
      try {
        await prisma.city.createMany({
          data: batch,
          skipDuplicates: true,
        });
        importedCount += batch.length;
        process.stdout.write(`\r📊 Importé: ${importedCount}/${formattedCities.length} villes françaises`);
      } catch (error) {
        console.error(`\n❌ Erreur lors de l'import du batch ${i}-${i + batchSize}:`, error);
      }
    }

    console.log(`\n✅ Import terminé: ${importedCount} villes françaises importées`);
  } catch (error) {
    console.error('❌ Erreur lors de l\'import des villes françaises:', error);
    throw error;
  }
}

/**
 * Importe les villes pour d'autres pays (optionnel)
 */
async function importOtherCountriesCities(
  countryCodes: string[] = ['BE', 'CH', 'CA', 'CG', 'CD'],
  batchSize: number = 50
): Promise<void> {
  console.log('\n🌍 Import des villes pour d\'autres pays...\n');

  let totalImported = 0;

  for (const countryCode of countryCodes) {
    try {
      const places = await fetchCitiesForCountry(countryCode, 100);
      const formattedCities = places.map(place => formatNominatimCity(place, countryCode));

      if (formattedCities.length > 0) {
        await prisma.city.createMany({
          data: formattedCities,
          skipDuplicates: true,
        });
        totalImported += formattedCities.length;
        console.log(`✅ ${formattedCities.length} villes importées pour ${countryCode}`);
      }

      // Attendre 1 seconde entre les requêtes pour respecter le rate limit de Nominatim
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`❌ Erreur pour ${countryCode}:`, error);
    }
  }

  console.log(`\n✅ Total: ${totalImported} villes importées pour les autres pays`);
}

/**
 * Fonction principale
 */
async function main() {
  console.log('🏙️  Import des villes depuis les APIs publiques\n');
  console.log('='.repeat(60));
  console.log('ℹ️  Sources utilisées:');
  console.log('   - France: API Gouv (geo.api.gouv.fr)');
  console.log('   - Autres pays: OpenStreetMap Nominatim');
  console.log('='.repeat(60));
  console.log('');
  
  try {
    // Vider la table avant import (optionnel)
    console.log('🗑️  Nettoyage de la table existante...');
    await prisma.city.deleteMany({});
    console.log('✅ Table nettoyée\n');

    // Importer les villes françaises (prioritaire)
    await importFrenchCities();

    // Importer les villes d'autres pays (optionnel, peut être commenté)
    // await importOtherCountriesCities();

    console.log('\n🎉 Import terminé avec succès !');
    console.log('\n📋 Statistiques:');
    const totalCities = await prisma.city.count();
    const citiesByCountry = await prisma.city.groupBy({
      by: ['countryCode'],
      _count: true,
      orderBy: {
        _count: {
          countryCode: 'desc',
        },
      },
    });
    
    console.log(`   Total de villes: ${totalCities}`);
    console.log('\n   Par pays:');
    citiesByCountry.forEach((item) => {
      console.log(`   - ${item.countryCode}: ${item._count} villes`);
    });

    const majorCities = await prisma.city.count({
      where: {
        isMajor: true,
      },
    });
    console.log(`\n   Grandes villes (isMajor=true): ${majorCities}`);

  } catch (error) {
    console.error('\n💥 Erreur:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
main();

