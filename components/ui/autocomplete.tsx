"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn, normalizeString } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface AutocompleteOption {
  value: string;
  label: string;
  code?: string;
}

interface AutocompleteProps {
  options: AutocompleteOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  onSearchChange?: (search: string) => void; // Callback pour la recherche dynamique
  popoverZIndex?: number; // Z-index personnalisé pour le popover
}

export function Autocomplete({
  options,
  value,
  onValueChange,
  placeholder = "Sélectionner...",
  searchPlaceholder = "Rechercher...",
  emptyMessage = "Aucun résultat trouvé.",
  disabled = false,
  loading = false,
  className,
  onSearchChange,
  popoverZIndex = 100,
}: AutocompleteProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const selectedOption = options.find((option) => option.value === value);

  // Notifier le parent des changements de recherche
  React.useEffect(() => {
    if (onSearchChange) {
      onSearchChange(search);
    }
  }, [search, onSearchChange]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between h-11 sm:h-9 min-h-[44px] sm:min-h-0",
            "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600",
            "hover:bg-gray-50 dark:hover:bg-gray-700",
            "focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
            !value && "text-gray-400 dark:text-gray-500",
            value && "text-gray-900 dark:text-gray-100 font-medium",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
          disabled={disabled}
        >
          <span className={cn(
            "truncate text-left",
            !value && "text-gray-400 dark:text-gray-500",
            value && "text-gray-900 dark:text-gray-100"
          )}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronsUpDown className={cn(
            "ml-2 h-4 w-4 shrink-0",
            !value ? "text-gray-400 dark:text-gray-500" : "text-gray-600 dark:text-gray-400"
          )} />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-full p-0" 
        align="start" 
        style={{ 
          width: 'var(--radix-popover-trigger-width)',
          zIndex: popoverZIndex
        }}
      >
        <Command 
          shouldFilter={!onSearchChange}
          filter={(value, search) => {
            // Filtrage non case sensitive et insensible aux accents quand le parent ne gère pas la recherche
            if (!onSearchChange) {
              const searchNormalized = normalizeString(search);
              const valueNormalized = normalizeString(value);
              return valueNormalized.includes(searchNormalized) ? 1 : 0;
            }
            return 1; // Pas de filtrage si le parent gère la recherche
          }}
        >
          <CommandInput 
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {loading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {!loading && (
              <>
                <CommandEmpty>{emptyMessage}</CommandEmpty>
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.label}
                      onSelect={() => {
                        onValueChange(option.value === value ? "" : option.value);
                        setOpen(false);
                        setSearch(""); // Réinitialiser la recherche après sélection
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === option.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {option.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

