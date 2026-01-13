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
}

export function DataTable<TData>({ table, emptyMessage = "Aucune donnée trouvée" }: DataTableProps<TData>) {
  const rows = table.getRowModel().rows;
  const headers = table.getHeaderGroups();

  if (rows.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full min-w-0 md:min-w-[640px]">
          <thead className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700 sticky top-0 z-10 shadow-sm">
            {headers.map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b-2 border-slate-300 dark:border-slate-600">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="text-left px-2 py-3 sm:px-4 sm:py-4 font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm uppercase tracking-wider"
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
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr 
                key={row.id} 
                className={`
                  border-b border-gray-200 dark:border-gray-700 
                  ${index % 2 === 0 
                    ? 'bg-white dark:bg-gray-900' 
                    : 'bg-gray-50/50 dark:bg-gray-800/30'
                  }
                  hover:bg-blue-50 dark:hover:bg-blue-900/20 
                  hover:border-blue-200 dark:hover:border-blue-700
                  transition-colors
                `}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-2 py-1.5 sm:px-4 sm:py-2 text-gray-900 dark:text-gray-100 text-xs sm:text-sm">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
