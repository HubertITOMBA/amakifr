"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table } from "@tanstack/react-table";
import { Columns } from "lucide-react";

interface ColumnVisibilityToggleProps<TData> {
  table: Table<TData>;
  storageKey?: string; // Clé pour sauvegarder les préférences dans localStorage
}

export function ColumnVisibilityToggle<TData>({ 
  table, 
  storageKey 
}: ColumnVisibilityToggleProps<TData>) {
  const [isOpen, setIsOpen] = useState(false);

  // Récupérer toutes les colonnes sauf celles qui doivent toujours être visibles (comme les actions)
  const columns = table
    .getAllColumns()
    .filter((column) => {
      // Filtrer les colonnes qui ne doivent pas être cachées (comme les actions)
      const columnDef = column.columnDef;
      // Si la colonne a un meta.forceVisible, on ne l'affiche pas dans la liste
      const meta = columnDef.meta as { forceVisible?: boolean } | undefined;
      if (meta?.forceVisible) {
        return false;
      }
      // Exclure les colonnes de sélection si elles existent
      if (column.id === "select" || column.id === "actions") {
        return false;
      }
      return column.getCanHide();
    });

  const handleToggle = (columnId: string, checked: boolean) => {
    // Mettre à jour la visibilité de la colonne
    table.getColumn(columnId)?.toggleVisibility(checked);
    
    // Sauvegarder les préférences dans localStorage si une clé est fournie
    if (storageKey) {
      const visibility = table.getState().columnVisibility;
      const newVisibility = { ...visibility, [columnId]: checked };
      
      // Filtrer pour ne garder que les colonnes de cette table
      const filteredVisibility: Record<string, boolean> = {};
      columns.forEach(col => {
        if (col.id in newVisibility) {
          filteredVisibility[col.id] = newVisibility[col.id] ?? true;
        }
      });
      
      try {
        localStorage.setItem(storageKey, JSON.stringify(filteredVisibility));
      } catch (error) {
        console.error("Erreur lors de la sauvegarde des préférences:", error);
      }
    }
  };

  const handleShowAll = () => {
    columns.forEach((column) => {
      table.getColumn(column.id)?.toggleVisibility(true);
      handleToggle(column.id, true);
    });
  };

  const handleHideAll = () => {
    columns.forEach((column) => {
      table.getColumn(column.id)?.toggleVisibility(false);
      handleToggle(column.id, false);
    });
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 h-8 text-xs sm:text-sm px-2 sm:px-3">
          <Columns className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">Colonnes</span>
          <span className="sm:hidden">Col.</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[200px] max-h-[400px] overflow-y-auto">
        <DropdownMenuLabel>Colonnes visibles</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="p-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start h-8 text-xs"
            onClick={handleShowAll}
          >
            Tout afficher
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start h-8 text-xs"
            onClick={handleHideAll}
          >
            Tout masquer
          </Button>
        </div>
        <DropdownMenuSeparator />
        {columns.map((column) => {
          const columnDef = column.columnDef;
          const header = typeof columnDef.header === "string" 
            ? columnDef.header 
            : columnDef.id || column.id;
          
          return (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={column.getIsVisible()}
              onCheckedChange={(checked) => handleToggle(column.id, checked as boolean)}
              className="capitalize"
            >
              {header}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

