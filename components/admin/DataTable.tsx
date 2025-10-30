"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
  getFilteredRowModel,
  ColumnFiltersState,
  Table as TanstackTable,
} from "@tanstack/react-table";
import { useState } from "react";
import { SortButton } from "./SortButton";

interface DataTableProps<TData> {
  table: TanstackTable<TData>;
  emptyMessage?: string;
}

export function DataTable<TData>({ table, emptyMessage = "Aucune donnée trouvée" }: DataTableProps<TData>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b border-gray-200 dark:border-gray-700">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="text-left p-4 font-medium text-gray-500 dark:text-gray-400"
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
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="p-4">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {table.getRowModel().rows.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          {emptyMessage}
        </div>
      )}
    </div>
  );
}
