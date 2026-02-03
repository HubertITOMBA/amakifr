"use client";

import {
  flexRender,
  Table as TanstackTable,
} from "@tanstack/react-table";
import { SortButton } from "./SortButton";

interface DataTableProps<TData> {
  table: TanstackTable<TData>;
  emptyMessage?: string;
  virtualizeThreshold?: number; // non utilisé, conservé pour compatibilité
  estimateRowHeight?: number; // non utilisé, conservé pour compatibilité
  disableVirtualization?: boolean; // non utilisé, conservé pour compatibilité
  headerColor?: "blue" | "purple" | "green" | "orange" | "red" | "indigo" | "pink" | "teal"; // Couleur du thème pour les en-têtes
  compact?: boolean; // Mode compact pour réduire les espacements
  resizable?: boolean; // Permet d'agrandir ou rétrécir la largeur des colonnes par glisser-déposer
  headerUppercase?: boolean; // Si false, les en-têtes ne sont pas en majuscules (défaut: true)
  headerBold?: boolean; // Si true, les en-têtes sont en gras (défaut: false)
  showCellBorders?: boolean; // Affiche les bordures entre cellules (lignes et colonnes) comme sur cotisations/gestion
}

export function DataTable<TData>({ table, emptyMessage = "Aucune donnée trouvée", headerColor = "blue", compact = false, resizable = false, headerUppercase = true, headerBold = false, showCellBorders = false }: DataTableProps<TData>) {
  const rows = table.getRowModel().rows;
  const headers = table.getHeaderGroups();

  // Couleurs pour les en-têtes selon le thème
  const headerColorClasses = {
    blue: "bg-gradient-to-r from-blue-100 via-blue-50 to-blue-100 dark:from-blue-900/40 dark:via-blue-800/30 dark:to-blue-900/40 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-100",
    purple: "bg-gradient-to-r from-purple-100 via-purple-50 to-purple-100 dark:from-purple-900/40 dark:via-purple-800/30 dark:to-purple-900/40 border-purple-300 dark:border-purple-700 text-purple-900 dark:text-purple-100",
    green: "bg-gradient-to-r from-green-100 via-green-50 to-green-100 dark:from-green-900/40 dark:via-green-800/30 dark:to-green-900/40 border-green-300 dark:border-green-700 text-green-900 dark:text-green-100",
    orange: "bg-gradient-to-r from-orange-100 via-orange-50 to-orange-100 dark:from-orange-900/40 dark:via-orange-800/30 dark:to-orange-900/40 border-orange-300 dark:border-orange-700 text-orange-900 dark:text-orange-100",
    red: "bg-gradient-to-r from-red-100 via-red-50 to-red-100 dark:from-red-900/40 dark:via-red-800/30 dark:to-red-900/40 border-red-300 dark:border-red-700 text-red-900 dark:text-red-100",
    indigo: "bg-gradient-to-r from-indigo-100 via-indigo-50 to-indigo-100 dark:from-indigo-900/40 dark:via-indigo-800/30 dark:to-indigo-900/40 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-100",
    pink: "bg-gradient-to-r from-pink-100 via-pink-50 to-pink-100 dark:from-pink-900/40 dark:via-pink-800/30 dark:to-pink-900/40 border-pink-300 dark:border-pink-700 text-pink-900 dark:text-pink-100",
    teal: "bg-gradient-to-r from-teal-100 via-teal-50 to-teal-100 dark:from-teal-900/40 dark:via-teal-800/30 dark:to-teal-900/40 border-teal-300 dark:border-teal-700 text-teal-900 dark:text-teal-100",
  };

  // Couleurs pour les lignes selon le thème
  const rowHoverColors = {
    blue: "hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-200 dark:hover:border-blue-700",
    purple: "hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-200 dark:hover:border-purple-700",
    green: "hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-200 dark:hover:border-green-700",
    orange: "hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:border-orange-200 dark:hover:border-orange-700",
    red: "hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200 dark:hover:border-red-700",
    indigo: "hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-200 dark:hover:border-indigo-700",
    pink: "hover:bg-pink-50 dark:hover:bg-pink-900/20 hover:border-pink-200 dark:hover:border-pink-700",
    teal: "hover:bg-teal-50 dark:hover:bg-teal-900/20 hover:border-teal-200 dark:hover:border-teal-700",
  };

  // Couleurs pour les lignes alternées selon le thème
  const rowAlternateColors = {
    blue: {
      even: "bg-white dark:bg-gray-900",
      odd: "bg-blue-50/30 dark:bg-blue-900/10",
    },
    purple: {
      even: "bg-white dark:bg-gray-900",
      odd: "bg-purple-50/30 dark:bg-purple-900/10",
    },
    green: {
      even: "bg-white dark:bg-gray-900",
      odd: "bg-green-50/30 dark:bg-green-900/10",
    },
    orange: {
      even: "bg-white dark:bg-gray-900",
      odd: "bg-orange-50/30 dark:bg-orange-900/10",
    },
    red: {
      even: "bg-white dark:bg-gray-900",
      odd: "bg-red-50/30 dark:bg-red-900/10",
    },
    indigo: {
      even: "bg-white dark:bg-gray-900",
      odd: "bg-indigo-50/30 dark:bg-indigo-900/10",
    },
    pink: {
      even: "bg-white dark:bg-gray-900",
      odd: "bg-pink-50/30 dark:bg-pink-900/10",
    },
    teal: {
      even: "bg-white dark:bg-gray-900",
      odd: "bg-teal-50/30 dark:bg-teal-900/10",
    },
  };

  const headerClasses = headerColorClasses[headerColor];
  const hoverClasses = rowHoverColors[headerColor];
  const alternateColors = rowAlternateColors[headerColor];

  if (rows.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        {emptyMessage}
      </div>
    );
  }

  const headerPadding = compact ? "px-2 py-1" : "px-2 py-3 sm:px-4 sm:py-4";
  const cellPadding = compact ? "px-2 py-0.5" : "px-2 py-1.5 sm:px-4 sm:py-2";
  const headerTextSize = compact ? "text-xs" : "text-xs sm:text-sm";
  const cellTextSize = compact ? "text-xs" : "text-xs sm:text-sm";
  const maxHeight = compact ? "max-h-full" : "max-h-[70vh]";

  return (
    <div className={`${compact ? 'overflow-hidden' : 'overflow-x-auto'} -mx-4 sm:mx-0 h-full`}>
      <div className={`${maxHeight} overflow-auto h-full`}>
        <table className={`w-full ${compact || resizable ? 'table-fixed' : ''} md:table-auto min-w-0 md:min-w-[640px]`} style={compact || resizable ? { tableLayout: 'fixed', width: '100%' } : {}}>
          <thead className={`${headerClasses} sticky top-0 z-10 shadow-sm`}>
            {headers.map((headerGroup) => (
              <tr key={headerGroup.id} className={`border-b-2 ${showCellBorders ? "border-gray-300 dark:border-gray-600" : ""}`}>
                {headerGroup.headers.map((header, headerIndex) => {
                  const columnId = header.column.id;
                  const isLastHeader = headerIndex === headerGroup.headers.length - 1;
                  // Masquer certaines colonnes sur mobile pour éviter le scroll horizontal
                  // Cette logique est spécifique aux pages avec compact=true
                  // En mode mobile, seules "titre" et "actions" doivent être visibles
                  const isMobileHidden = compact && !resizable && ['dateReunion', 'CreatedBy', 'createdAt'].includes(columnId);
                  const canResize = resizable && header.column.getCanResize();
                  const col = header.column;
                  const getNum = (fn: (() => number) | undefined): number | undefined =>
                    typeof fn === "function" ? fn() : undefined;
                  const colSize = resizable ? (getNum(header.getSize?.()) ?? getNum(col.getSize?.())) : undefined;
                  const colMin = resizable ? getNum(col.getMinSize?.()) : undefined;
                  const colMax = resizable ? getNum(col.getMaxSize?.()) : undefined;
                  const thStyle = resizable
                    ? {
                        ...(typeof colSize === "number" && Number.isFinite(colSize) && { width: colSize }),
                        ...(typeof colMin === "number" && Number.isFinite(colMin) && { minWidth: colMin }),
                        ...(typeof colMax === "number" && Number.isFinite(colMax) && colMax < 10000 && { maxWidth: colMax }),
                      }
                    : compact && !isMobileHidden
                      ? (columnId === 'titre' ? { width: 'calc(100% - 70px)', maxWidth: 'calc(100% - 70px)', minWidth: 0 } : columnId === 'actions' ? { width: 70, minWidth: 70 } : undefined)
                      : undefined;
                  return (
                  <th
                    key={header.id}
                    className={`text-left ${headerPadding} ${headerBold ? "font-bold" : "font-semibold"} ${headerTextSize} ${headerUppercase ? "uppercase" : ""} tracking-wider ${isMobileHidden ? 'hidden md:table-cell' : ''} ${canResize ? 'relative' : ''} ${showCellBorders ? `border-r border-gray-200 dark:border-gray-700 ${isLastHeader ? "border-r-0" : ""}` : ""}`}
                    style={thStyle}
                  >
                    {header.isPlaceholder ? null : (
                      <SortButton
                        canSort={header.column.getCanSort()}
                        isSorted={header.column.getIsSorted()}
                        onToggleSorting={header.column.getToggleSortingHandler() || (() => {})}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                      </SortButton>
                    )}
                    {canResize && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none select-none hover:bg-current hover:opacity-30 active:bg-current active:opacity-50"
                        style={{ marginRight: -2 }}
                        title="Redimensionner la colonne"
                      />
                    )}
                  </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className={showCellBorders ? "divide-y divide-gray-200 dark:divide-gray-700" : ""}>
            {rows.map((row, index) => (
              <tr 
                key={row.id} 
                className={`
                  border-b border-gray-200 dark:border-gray-700
                  ${index % 2 === 0 
                    ? alternateColors.even
                    : alternateColors.odd
                  }
                  ${hoverClasses}
                  transition-colors
                `}
              >
                {row.getVisibleCells().map((cell, cellIndex) => {
                  const columnId = cell.column.id;
                  const visibleCells = row.getVisibleCells();
                  const isLastCell = showCellBorders && cellIndex === visibleCells.length - 1;
                  // Masquer certaines colonnes sur mobile pour éviter le scroll horizontal
                  const isMobileHidden = compact && !resizable && ['dateReunion', 'CreatedBy', 'createdAt'].includes(columnId);
                  const cellCol = cell.column;
                  const getCellNum = (fn: (() => number) | undefined): number | undefined =>
                    typeof fn === "function" ? fn() : undefined;
                  const cellSize = resizable ? getCellNum(cellCol.getSize?.()) : undefined;
                  const cellMin = resizable ? getCellNum(cellCol.getMinSize?.()) : undefined;
                  const cellMaxSize = resizable ? getCellNum(cellCol.getMaxSize?.()) : undefined;
                  const tdStyle = resizable
                    ? {
                        ...(typeof cellSize === "number" && Number.isFinite(cellSize) && { width: cellSize }),
                        ...(typeof cellMin === "number" && Number.isFinite(cellMin) && { minWidth: cellMin }),
                        ...(typeof cellMaxSize === "number" && Number.isFinite(cellMaxSize) && cellMaxSize < 10000 && { maxWidth: cellMaxSize }),
                      }
                    : compact && !isMobileHidden
                      ? (columnId === 'titre' ? { width: 'calc(100% - 70px)', maxWidth: 'calc(100% - 70px)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' } : columnId === 'actions' ? { width: 70, minWidth: 70 } : undefined)
                      : undefined;
                  return (
                  <td 
                    key={cell.id} 
                    className={`${cellPadding} text-gray-900 dark:text-gray-100 ${cellTextSize} ${isMobileHidden ? 'hidden md:table-cell' : ''} ${compact && columnId === 'titre' ? 'overflow-hidden' : ''} ${showCellBorders ? `border-r border-gray-200 dark:border-gray-700 ${isLastCell ? "border-r-0" : ""}` : ""}`}
                    style={tdStyle}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
