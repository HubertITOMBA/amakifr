"use client";

import { useState, useEffect } from "react";
import { Autocomplete } from "@/components/ui/autocomplete";
import { getCountries } from "@/lib/api/countries";

interface CountryAutocompleteProps {
  value?: string;
  onValueChange: (value: string) => void;
  onCountryCodeChange?: (code: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function CountryAutocomplete({
  value,
  onValueChange,
  onCountryCodeChange,
  disabled = false,
  placeholder = "Sélectionner un pays...",
}: CountryAutocompleteProps) {
  const [countries, setCountries] = useState<Array<{ value: string; label: string; code: string }>>([]);
  const [loading, setLoading] = useState(true);

  // Charger la liste des pays au montage
  useEffect(() => {
    const loadCountries = async () => {
      try {
        setLoading(true);
        const allCountries = await getCountries();
        setCountries(allCountries);
      } catch (error) {
        console.error("Erreur lors du chargement des pays:", error);
      } finally {
        setLoading(false);
      }
    };

    loadCountries();
  }, []);

  // Notifier le parent du code pays quand la valeur change
  useEffect(() => {
    if (value && onCountryCodeChange) {
      const selected = countries.find(c => c.value === value);
      if (selected) {
        onCountryCodeChange(selected.code);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, countries]); // Retirer onCountryCodeChange des dépendances pour éviter les boucles

  return (
    <Autocomplete
      options={countries}
      value={value}
      onValueChange={onValueChange}
      placeholder={placeholder}
      searchPlaceholder="Rechercher un pays..."
      emptyMessage="Aucun pays trouvé."
      disabled={disabled}
      loading={loading}
      popoverZIndex={100}
    />
  );
}

