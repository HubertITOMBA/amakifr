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
      
      // Si la valeur correspond à l'adresse sélectionnée (par street, label ou ID), ne rien faire
      if (selectedAddress) {
        const addressStreet = selectedAddress.street || "";
        const addressLabel = selectedAddress.label || "";
        const addressId = selectedAddress.id || "";
        const currentSearchTerm = searchTerm || "";
        
        // Si la valeur correspond à une propriété de l'adresse sélectionnée, ne pas réinitialiser
        // Cela évite de réinitialiser quand le parent met à jour street1 avec la valeur extraite
        if (value === addressStreet || value === addressLabel || value === addressId || value === currentSearchTerm) {
          return;
        }
      }
      
      // Sinon, mettre à jour searchTerm et réinitialiser selectedAddress
      // Si value est vide, réinitialiser tout
      if (!value || value.trim().length === 0) {
        setSearchTerm("");
        setSelectedAddress(null);
      } else {
        // Si la valeur ne correspond pas à l'adresse sélectionnée, mettre à jour
        setSearchTerm(value);
        // Ne réinitialiser selectedAddress que si la valeur ne correspond pas à l'ID de l'adresse
        if (!selectedAddress || selectedAddress.id !== value) {
          setSelectedAddress(null);
        }
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
    const displayValue = address.street || address.label.split(",")[0].replace(/^\d+(\s+(bis|ter|quater))?\s*/, "").trim();
    setSearchTerm(displayValue);
    prevValueRef.current = address.id; // Utiliser l'ID pour la correspondance avec option.value
    
    // Notifier le parent immédiatement avec l'adresse complète
    // Cela déclenchera handleAddressChange qui mettra à jour street1, codepost, city, etc.
    if (onValueChange) {
      onValueChange(address);
    }
  }, [onValueChange]);

  // Formater les options pour l'Autocomplete
  // Utiliser l'ID comme value pour permettre la correspondance exacte
  const options = addresses.map((address) => ({
    value: address.id, // ID unique pour la correspondance
    label: address.label, // Label affiché
    code: `${address.postcode} ${address.city}`, // Code postal et ville en sous-titre
  }));

  // Gérer la sélection depuis l'Autocomplete
  const handleValueChange = useCallback((selectedValue: string) => {
    if (!selectedValue || selectedValue.trim().length === 0) {
      // Valeur vide
      isInternalUpdateRef.current = true;
      setSearchTerm("");
      setSelectedAddress(null);
      prevValueRef.current = "";
      if (onValueChange) {
        onValueChange(null);
      }
      return;
    }

    // Trouver l'adresse correspondante
    // selectedValue est normalement l'ID de l'adresse (option.value) quand on sélectionne depuis la liste
    // ou une chaîne de texte quand c'est une saisie libre
    const address = addresses.find((a) => a.id === selectedValue);
    
    if (address) {
      // Si une adresse est trouvée dans la liste, l'utiliser
      // Cela mettra à jour selectedAddress et appellera onValueChange avec l'adresse complète
      handleSelect(address);
    } else if (selectedValue.startsWith("free-text-")) {
      // C'est une saisie libre déjà formatée, ne rien faire (déjà géré)
      return;
    } else {
      // Sinon, c'est une saisie libre - mettre à jour directement
      isInternalUpdateRef.current = true;
      setSearchTerm(selectedValue);
      setSelectedAddress(null);
      prevValueRef.current = selectedValue;
      
      // Notifier le parent avec un objet AddressResult minimal pour la saisie libre
      if (onValueChange) {
        const freeTextAddress: AddressResult = {
          id: `free-text-${Date.now()}`,
          label: selectedValue,
          street: selectedValue,
          postcode: "",
          city: "",
          housenumber: "",
        };
        onValueChange(freeTextAddress);
      }
    }
  }, [addresses, handleSelect, onValueChange]);

  return (
    <div className={className}>
      <Autocomplete
        value={selectedAddress?.id || ""}
        onValueChange={handleValueChange}
        onSearchChange={(newSearch) => {
          isInternalUpdateRef.current = true; // Marquer comme mise à jour interne
          setSearchTerm(newSearch);
          // Si l'utilisateur tape, réinitialiser l'adresse sélectionnée
          const currentStreet = selectedAddress?.street || selectedAddress?.label;
          if (newSearch !== currentStreet && newSearch !== selectedAddress?.id) {
            setSelectedAddress(null);
          }
          prevValueRef.current = newSearch; // Mettre à jour la ref
        }}
        options={options}
        placeholder={placeholder}
        disabled={disabled}
        loading={loading}
        allowFreeText={true}
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

