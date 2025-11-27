"use server";

/**
 * Server Action pour rechercher des adresses via l'API BAN (Base Adresse Nationale)
 * 
 * L'API BAN est gratuite et ne nécessite pas de clé API.
 * Elle permet de rechercher des adresses en France avec autocomplétion.
 * 
 * @param query - Terme de recherche (adresse, code postal, ville, etc.)
 * @param limit - Nombre maximum de résultats (défaut: 10)
 * @returns Liste des adresses trouvées
 */

import { db } from "@/lib/db";

const BAN_API_URL = "https://api-adresse.data.gouv.fr/search";

interface BanAddressFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: [number, number]; // [longitude, latitude]
  };
  properties: {
    label: string;
    score: number;
    housenumber?: string;
    street?: string;
    postcode: string;
    city: string;
    citycode: string;
    context: string; // "75, Paris, Île-de-France"
    type: string; // "housenumber", "street", "municipality", etc.
    importance: number;
    name?: string;
  };
}

interface BanApiResponse {
  type: string;
  version: string;
  features: BanAddressFeature[];
  attribution: string;
  licence: string;
  query: string;
  limit: number;
}

export interface AddressResult {
  id: string;
  label: string;
  housenumber?: string;
  street?: string;
  postcode: string;
  city: string;
  citycode: string;
  department?: string;
  region?: string;
  latitude: number;
  longitude: number;
  score: number;
  type: string;
}

/**
 * Recherche des adresses via l'API BAN
 */
export async function searchAddresses(
  query: string,
  limit: number = 10
): Promise<{ success: boolean; addresses?: AddressResult[]; error?: string }> {
  try {
    if (!query || query.trim().length < 3) {
      return {
        success: false,
        error: "La recherche doit contenir au moins 3 caractères",
      };
    }

    // Construire l'URL de recherche
    const searchUrl = new URL(BAN_API_URL);
    searchUrl.searchParams.set("q", query.trim());
    searchUrl.searchParams.set("limit", limit.toString());
    searchUrl.searchParams.set("autocomplete", "1"); // Activer l'autocomplétion

    // Effectuer la requête
    const response = await fetch(searchUrl.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "AMAKI-FR-Application/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status} - ${response.statusText}`);
    }

    const data: BanApiResponse = await response.json();

    // Formater les résultats
    const addresses: AddressResult[] = data.features.map((feature) => {
      const props = feature.properties;
      const [longitude, latitude] = feature.geometry.coordinates;

      // Extraire le département et la région depuis le contexte
      const contextParts = props.context.split(",").map((s) => s.trim());
      const department = contextParts[0] || null;
      const region = contextParts[2] || null;

      // Générer un ID unique basé sur les propriétés
      const banId = `${props.citycode}-${props.postcode}-${props.housenumber || ""}-${props.street || ""}`.replace(/\s+/g, "-");

      return {
        id: banId,
        label: props.label,
        housenumber: props.housenumber || undefined,
        street: props.street || undefined,
        postcode: props.postcode,
        city: props.city,
        citycode: props.citycode,
        department: department || undefined,
        region: region || undefined,
        latitude,
        longitude,
        score: props.score,
        type: props.type,
      };
    });

    // Mettre en cache les résultats dans la base de données
    if (addresses.length > 0) {
      await cacheAddresses(addresses);
    }

    return {
      success: true,
      addresses,
    };
  } catch (error) {
    console.error("Erreur lors de la recherche d'adresses:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur lors de la recherche d'adresses",
    };
  }
}

/**
 * Met en cache les adresses dans la base de données
 */
async function cacheAddresses(addresses: AddressResult[]): Promise<void> {
  try {
    for (const address of addresses) {
      // Créer un texte de recherche pour indexation
      const searchText = [
        address.label,
        address.housenumber,
        address.street,
        address.postcode,
        address.city,
        address.department,
        address.region,
      ]
        .filter(Boolean)
        .join(" ");

      await db.banAddress.upsert({
        where: {
          banId: address.id,
        },
        create: {
          banId: address.id,
          label: address.label,
          housenumber: address.housenumber || null,
          street: address.street || null,
          postcode: address.postcode,
          city: address.city,
          citycode: address.citycode,
          department: address.department || null,
          region: address.region || null,
          latitude: address.latitude,
          longitude: address.longitude,
          score: address.score,
          type: address.type,
          searchText: searchText,
          metadata: {
            source: "ban-api",
            cachedAt: new Date().toISOString(),
          },
        },
        update: {
          label: address.label,
          housenumber: address.housenumber || null,
          street: address.street || null,
          postcode: address.postcode,
          city: address.city,
          citycode: address.citycode,
          department: address.department || null,
          region: address.region || null,
          latitude: address.latitude,
          longitude: address.longitude,
          score: address.score,
          type: address.type,
          searchText: searchText,
          metadata: {
            source: "ban-api",
            cachedAt: new Date().toISOString(),
          },
        },
      });
    }
  } catch (error) {
    // Ne pas bloquer la recherche si le cache échoue
    console.error("Erreur lors de la mise en cache des adresses:", error);
  }
}

/**
 * Recherche des adresses depuis le cache local
 */
export async function searchAddressesFromCache(
  query: string,
  limit: number = 10
): Promise<{ success: boolean; addresses?: AddressResult[]; error?: string }> {
  try {
    if (!query || query.trim().length < 3) {
      return {
        success: false,
        error: "La recherche doit contenir au moins 3 caractères",
      };
    }

    const searchTerm = query.trim().toLowerCase();

    // Rechercher dans le cache
    const cachedAddresses = await db.banAddress.findMany({
      where: {
        OR: [
          {
            searchText: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
          {
            label: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
          {
            postcode: {
              contains: searchTerm,
            },
          },
          {
            city: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
          {
            street: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
        ],
      },
      orderBy: [
        {
          score: "desc",
        },
        {
          label: "asc",
        },
      ],
      take: limit,
    });

    const addresses: AddressResult[] = cachedAddresses.map((addr) => ({
      id: addr.banId,
      label: addr.label,
      housenumber: addr.housenumber || undefined,
      street: addr.street || undefined,
      postcode: addr.postcode,
      city: addr.city,
      citycode: addr.citycode,
      department: addr.department || undefined,
      region: addr.region || undefined,
      latitude: addr.latitude,
      longitude: addr.longitude,
      score: addr.score || 0,
      type: addr.type,
    }));

    return {
      success: true,
      addresses,
    };
  } catch (error) {
    console.error("Erreur lors de la recherche dans le cache:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur lors de la recherche dans le cache",
    };
  }
}

