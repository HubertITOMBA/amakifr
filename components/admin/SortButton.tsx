"use client";

import { Button } from "@/components/ui/button";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

interface SortButtonProps {
  canSort: boolean;
  isSorted: false | "asc" | "desc";
  onToggleSorting: (event?: unknown) => void;
  children: React.ReactNode;
}

export function SortButton({ canSort, isSorted, onToggleSorting, children }: SortButtonProps) {
  if (!canSort) {
    return <span>{children}</span>;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto p-0 font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
      onClick={onToggleSorting}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        {isSorted === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : isSorted === "desc" ? (
          <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        )}
      </div>
    </Button>
  );
}
