"use client";

import { useState, useEffect } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { Autocomplete } from "@/components/ui/autocomplete";
import { FRENCH_MAJOR_CITIES } from "@/lib/api/cities";
import { getCitiesByCountry } from "@/actions/location/get-cities";
import { normalizeString } from "@/lib/utils";

interface CityAutocompleteProps {
  value?: string;
  onValueChange: (value: string) => void;
  countryCode?: string;
  disabled?: boolean;
  placeholder?: string;
}

export function CityAutocomplete({
  value,
  onValueChange,
  countryCode,
  disabled = false,
  placeholder = "Sélectionner une ville...",
}: CityAutocompleteProps) {
  const [cities, setCities] = useState<Array<{ value: string; label: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 500);

  // Charger les villes selon le pays et le terme de recherche
  useEffect(() => {
    const loadCities = async () => {
      if (!countryCode) {
        setCities([]);
        setLoading(false);
        return;
      }

      // Pour la France, charger la liste de base si pas de recherche ou recherche trop courte
      if (countryCode === "FR" && (!debouncedSearch || debouncedSearch.length < 2)) {
        setCities(FRENCH_MAJOR_CITIES);
        setLoading(false);
        return;
      }

      // Pour les autres pays ou recherche active, charger depuis l'API
      if (!debouncedSearch || debouncedSearch.length < 2) {
        setCities([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const result = await getCitiesByCountry(countryCode, debouncedSearch);
        if (result.success && result.cities) {
          // Si pas de résultats de l'API et que c'est la France, utiliser la liste de base filtrée
          if (result.cities.length === 0 && countryCode === "FR") {
            const searchNormalized = normalizeString(debouncedSearch);
            setCities(FRENCH_MAJOR_CITIES.filter(city =>
              normalizeString(city.label).includes(searchNormalized)
            ));
          } else {
            setCities(result.cities);
          }
        } else {
          // Fallback sur la liste de base pour la France
          if (countryCode === "FR") {
            const searchNormalized = normalizeString(debouncedSearch);
            setCities(FRENCH_MAJOR_CITIES.filter(city =>
              normalizeString(city.label).includes(searchNormalized)
            ));
          } else {
            setCities([]);
          }
        }
      } catch (error) {
        console.error("Erreur lors du chargement des villes:", error);
        // Fallback sur la liste de base pour la France
        if (countryCode === "FR") {
          const searchNormalized = normalizeString(debouncedSearch);
          setCities(FRENCH_MAJOR_CITIES.filter(city =>
            normalizeString(city.label).includes(searchNormalized)
          ));
        } else {
          setCities([]);
        }
      } finally {
        setLoading(false);
      }
    };

    loadCities();
  }, [countryCode, debouncedSearch]);

  // Ne plus réinitialiser automatiquement la ville quand le countryCode change
  // Le parent (composant utilisateur) gère la réinitialisation de la ville lors du changement de pays
  // Cela évite de perdre la ville quand elle est remplie automatiquement depuis une adresse

  return (
    <Autocomplete
      options={cities}
      value={value}
      onValueChange={onValueChange}
      placeholder={placeholder}
      searchPlaceholder={countryCode ? "Rechercher une ville (min. 2 caractères)..." : "Sélectionnez d'abord un pays"}
      emptyMessage={countryCode ? "Aucune ville trouvée. Tapez au moins 2 caractères." : "Sélectionnez d'abord un pays"}
      disabled={disabled || !countryCode}
      loading={loading}
      onSearchChange={setSearchTerm}
      popoverZIndex={110}
    />
  );
}

