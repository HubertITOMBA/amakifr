"use client";

/**
 * Composant d'autocomplétion pour la recherche d'adresses via l'API BAN
 * 
 * Utilise l'API BAN (Base Adresse Nationale) pour rechercher des adresses
 * françaises avec autocomplétion en temps réel.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Autocomplete } from "@/components/ui/autocomplete";
import { searchAddresses } from "@/actions/location/search-address";
import { AddressResult } from "@/actions/location/search-address";
import { useDebounce } from "@/hooks/use-debounce";
import { Loader2, MapPin } from "lucide-react";

interface AddressAutocompleteProps {
  value?: string;
  onValueChange?: (address: AddressResult | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function AddressAutocomplete({
  value,
  onValueChange,
  placeholder = "Rechercher une adresse...",
  className,
  disabled = false,
}: AddressAutocompleteProps) {
  const [searchTerm, setSearchTerm] = useState(value || "");
  const [addresses, setAddresses] = useState<AddressResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<AddressResult | null>(null);

  // Synchroniser searchTerm avec la prop value quand elle change depuis l'extérieur
  // Utiliser une ref pour éviter les boucles infinies
  const prevValueRef = useRef<string | undefined>(value);
  const isInternalUpdateRef = useRef(false);
  
  useEffect(() => {
    // Ignorer les mises à jour internes
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      prevValueRef.current = value; // Mettre à jour la ref même pour les mises à jour internes
      return;
    }
    
    // Ne synchroniser que si la valeur a vraiment changé depuis l'extérieur
    if (value !== undefined && value !== prevValueRef.current) {
      const prevValue = prevValueRef.current;
      prevValueRef.current = value;
      
      // Ne mettre à jour que si la valeur est vraiment différente
      // et qu'elle ne correspond pas à l'adresse actuellement sélectionnée
      const shouldUpdate = value !== searchTerm && 
                          (!selectedAddress || (selectedAddress.street !== value && selectedAddress.label !== value));
      
      if (shouldUpdate) {
        setSearchTerm(value);
        // Si la valeur ne correspond ni au nom de la rue ni au label de l'adresse sélectionnée, réinitialiser
        if (!selectedAddress || (selectedAddress.street !== value && selectedAddress.label !== value)) {
          setSelectedAddress(null);
        }
      } else {
        // Si on ne met pas à jour, restaurer la ref précédente
        prevValueRef.current = prevValue;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]); // Ne dépendre que de value pour éviter les boucles

  // Debounce de la recherche (300ms)
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Rechercher des adresses
  const searchAddressesList = useCallback(async (query: string) => {
    if (!query || query.trim().length < 3) {
      setAddresses([]);
      return;
    }

    setLoading(true);
    try {
      const result = await searchAddresses(query, 10);
      if (result.success && result.addresses) {
        setAddresses(result.addresses);
      } else {
        setAddresses([]);
      }
    } catch (error) {
      console.error("Erreur lors de la recherche d'adresses:", error);
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Effectuer la recherche quand le terme de recherche change
  useEffect(() => {
    if (debouncedSearchTerm) {
      searchAddressesList(debouncedSearchTerm);
    } else {
      setAddresses([]);
    }
  }, [debouncedSearchTerm, searchAddressesList]);

  // Gérer la sélection d'une adresse
  const handleSelect = useCallback((address: AddressResult) => {
    isInternalUpdateRef.current = true; // Marquer comme mise à jour interne
    setSelectedAddress(address);
    // Afficher le nom de la rue (street) plutôt que l'adresse complète (label)
    // pour correspondre à ce qui est stocké dans street1
    const displayValue = address.street || address.label.split(",")[0].replace(/^\d+\s*/, "").trim();
    setSearchTerm(displayValue);
    prevValueRef.current = displayValue; // Mettre à jour la ref pour éviter la resynchronisation
    if (onValueChange) {
      onValueChange(address);
    }
  }, [onValueChange]);

  // Formater les options pour l'Autocomplete
  const options = addresses.map((address) => ({
    value: address.id,
    label: address.label,
    code: `${address.postcode} ${address.city}`,
  }));

  // Gérer la sélection depuis l'Autocomplete
  const handleValueChange = useCallback((selectedValue: string) => {
    // Trouver l'adresse correspondante AVANT de mettre à jour searchTerm
    const address = addresses.find((a) => a.id === selectedValue || a.label === selectedValue);
    
    if (address) {
      // Si une adresse est trouvée, l'utiliser
      handleSelect(address);
    } else {
      // Sinon, mettre à jour le terme de recherche (saisie manuelle)
      setSearchTerm(selectedValue);
      // Si la valeur est vide, réinitialiser
      if (!selectedValue) {
        setSelectedAddress(null);
        if (onValueChange) {
          onValueChange(null);
        }
      }
    }
  }, [addresses, handleSelect, onValueChange]);

  return (
    <div className={className}>
      <Autocomplete
        value={selectedAddress?.street || selectedAddress?.label || searchTerm || ""}
        onValueChange={handleValueChange}
        onSearchChange={(newSearch) => {
          isInternalUpdateRef.current = true; // Marquer comme mise à jour interne
          setSearchTerm(newSearch);
          // Si l'utilisateur tape, réinitialiser l'adresse sélectionnée
          const currentStreet = selectedAddress?.street || selectedAddress?.label;
          if (newSearch !== currentStreet) {
            setSelectedAddress(null);
          }
          prevValueRef.current = newSearch; // Mettre à jour la ref
        }}
        options={options}
        placeholder={placeholder}
        disabled={disabled}
        loading={loading}
        emptyMessage={
          loading ? (
            <div className="flex items-center justify-center gap-2 py-4">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              <span className="text-sm text-gray-500">Recherche en cours...</span>
            </div>
          ) : searchTerm.length < 3 ? (
            <div className="py-4 text-center text-sm text-gray-500">
              Tapez au moins 3 caractères pour rechercher
            </div>
          ) : (
            <div className="py-4 text-center text-sm text-gray-500">
              Aucune adresse trouvée
            </div>
          )
        }
      />
    </div>
  );
}

