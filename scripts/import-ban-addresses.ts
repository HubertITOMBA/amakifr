/**
 * Script pour importer des adresses depuis l'API BAN (Base Adresse Nationale)
 * 
 * Ce script permet d'importer en masse des adresses depuis l'API BAN
 * pour les stocker dans le cache local. Utile pour précharger des adresses
 * fréquemment recherchées.
 * 
 * Usage: npm run db:import-ban-addresses
 * 
 * Note: L'API BAN est gratuite et ne nécessite pas de clé API.
 * Ce script est optionnel car les adresses sont mises en cache automatiquement
 * lors des recherches via searchAddresses.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BAN_API_URL = "https://api-adresse.data.gouv.fr/search";

interface BanAddressFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: [number, number];
  };
  properties: {
    label: string;
    score: number;
    housenumber?: string;
    street?: string;
    postcode: string;
    city: string;
    citycode: string;
    context: string;
    type: string;
    importance: number;
  };
}

interface BanApiResponse {
  features: BanAddressFeature[];
}

/**
 * Recherche des adresses via l'API BAN
 */
async function fetchAddressesFromBan(query: string, limit: number = 10): Promise<BanAddressFeature[]> {
  try {
    const url = new URL(BAN_API_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", limit.toString());

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "AMAKI-FR-Application/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const data: BanApiResponse = await response.json();
    return data.features;
  } catch (error) {
    console.error(`Erreur lors de la recherche "${query}":`, error);
    return [];
  }
}

/**
 * Importe une adresse dans le cache
 */
async function importAddress(feature: BanAddressFeature): Promise<void> {
  try {
    const props = feature.properties;
    const [longitude, latitude] = feature.geometry.coordinates;

    // Extraire le département et la région
    const contextParts = props.context.split(",").map((s) => s.trim());
    const department = contextParts[0] || null;
    const region = contextParts[2] || null;

    // Générer un ID unique
    const banId = `${props.citycode}-${props.postcode}-${props.housenumber || ""}-${props.street || ""}`.replace(/\s+/g, "-");

    // Créer le texte de recherche
    const searchText = [
      props.label,
      props.housenumber,
      props.street,
      props.postcode,
      props.city,
      department,
      region,
    ]
      .filter(Boolean)
      .join(" ");

    await prisma.banAddress.upsert({
      where: {
        banId: banId,
      },
      create: {
        banId: banId,
        label: props.label,
        housenumber: props.housenumber || null,
        street: props.street || null,
        postcode: props.postcode,
        city: props.city,
        citycode: props.citycode,
        department: department || null,
        region: region || null,
        latitude: latitude,
        longitude: longitude,
        score: props.score,
        type: props.type,
        searchText: searchText,
        metadata: {
          source: "ban-api",
          importedAt: new Date().toISOString(),
        },
      },
      update: {
        label: props.label,
        housenumber: props.housenumber || null,
        street: props.street || null,
        postcode: props.postcode,
        city: props.city,
        citycode: props.citycode,
        department: department || null,
        region: region || null,
        latitude: latitude,
        longitude: longitude,
        score: props.score,
        type: props.type,
        searchText: searchText,
        metadata: {
          source: "ban-api",
          updatedAt: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error(`Erreur lors de l'import de l'adresse "${feature.properties.label}":`, error);
  }
}

/**
 * Fonction principale
 */
async function main() {
  console.log('🏠 Import d\'adresses depuis l\'API BAN\n');
  console.log('='.repeat(60));
  console.log('ℹ️  Note: Ce script est optionnel.');
  console.log('   Les adresses sont mises en cache automatiquement lors des recherches.');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Exemples de recherches pour précharger des adresses communes
    const searchQueries = [
      "Paris",
      "Lyon",
      "Marseille",
      "Toulouse",
      "Nice",
      "Nantes",
      "Strasbourg",
      "Montpellier",
      "Bordeaux",
      "Lille",
    ];

    let totalImported = 0;

    for (const query of searchQueries) {
      console.log(`📥 Recherche d'adresses pour "${query}"...`);
      
      const features = await fetchAddressesFromBan(query, 20);
      
      if (features.length > 0) {
        console.log(`   ✅ ${features.length} adresses trouvées`);
        
        for (const feature of features) {
          await importAddress(feature);
          totalImported++;
        }
        
        // Attendre 1 seconde entre les requêtes pour respecter le rate limit
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.log(`   ⚠️  Aucune adresse trouvée`);
      }
    }

    console.log(`\n✅ Import terminé: ${totalImported} adresses importées`);

    // Afficher les statistiques
    const totalCached = await prisma.banAddress.count();
    const byDepartment = await prisma.banAddress.groupBy({
      by: ['department'],
      _count: true,
      orderBy: {
        _count: {
          department: 'desc',
        },
      },
      take: 10,
    });

    console.log('\n📋 Statistiques:');
    console.log(`   Total d'adresses en cache: ${totalCached}`);
    console.log('\n   Par département (top 10):');
    byDepartment.forEach((item) => {
      if (item.department) {
        console.log(`   - ${item.department}: ${item._count} adresses`);
      }
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

