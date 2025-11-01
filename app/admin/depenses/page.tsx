"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Receipt, Euro, Plus, Eye, Edit, Trash2, DollarSign } from "lucide-react";
import Link from "next/link";
import { getAllDepenses, deleteDepense, getDepenseStats } from "@/actions/depenses";
import { toast } from "sonner";
import { createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, useReactTable, SortingState, ColumnFiltersState } from "@tanstack/react-table";

interface Depense {
  id: string;
  libelle: string;
  montant: number;
  dateDepense: string;
  categorie: string;
  description?: string;
  justificatif?: string;
  statut: string;
  CreatedBy: {
    id: string;
    email: string;
  };
}

const columnHelper = createColumnHelper<Depense>();

const getStatusColor = (statut: string) => {
  switch (statut) {
    case "Valide":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "Rejete":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    case "EnAttente":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  }
};

export default function AdminDepensesPage() {
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const loadAll = async () => {
    const res = await getAllDepenses();
    if (res.success) setDepenses(res.data || []);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await loadAll();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette dépense ?")) return;
    const res = await deleteDepense(id);
    if (res.success) {
      toast.success("Dépense supprimée");
      await loadAll();
    } else {
      toast.error(res.error || "Erreur lors de la suppression");
    }
  };

  const columns = useMemo(() => [
    columnHelper.accessor("libelle", {
      header: "Libellé",
      cell: info => <div className="font-medium">{info.getValue()}</div>,
    }),
    columnHelper.accessor("montant", {
      header: "Montant",
      cell: info => <div className="text-right font-bold">{Number(info.getValue()).toFixed(2).replace('.', ',')} €</div>,
    }),
    columnHelper.accessor("dateDepense", {
      header: "Date",
      cell: info => <div className="text-sm">{new Date(info.getValue()).toLocaleDateString('fr-FR')}</div>,
    }),
    columnHelper.accessor("categorie", {
      header: "Catégorie",
      cell: info => <Badge variant="outline">{info.getValue()}</Badge>,
    }),
    columnHelper.accessor("statut", {
      header: "Statut",
      cell: info => <Badge className={`${getStatusColor(info.getValue())} text-xs`}>{info.getValue()}</Badge>,
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const d = row.original;
        return (
          <div className="flex space-x-2">
            <Link href={`/admin/depenses/${d.id}/consultation`}>
              <Button size="sm" variant="outline">
                <Eye className="h-4 w-4" />
              </Button>
            </Link>
            <Link href={`/admin/depenses/${d.id}/edition`}>
              <Button size="sm" variant="outline">
                <Edit className="h-4 w-4" />
              </Button>
            </Link>
            <Button size="sm" variant="outline" onClick={() => handleDelete(d.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    }),
  ], []);

  const table = useReactTable({
    data: depenses.filter(d => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return [
        d.libelle || "",
        d.categorie || "",
        d.description || "",
        d.statut || "",
      ].join(" ").toLowerCase().includes(q);
    }),
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: { sorting, columnFilters },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <Receipt className="h-5 w-5 mr-2" />
              Gestion des Dépenses
            </span>
            <div className="flex items-center gap-2">
              <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
              <Link href="/admin/depenses/gestion">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle dépense
                </Button>
              </Link>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  {table.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map(header => (
                        <th key={header.id} className="text-left p-2 border-b">
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map(row => (
                    <tr key={row.id} className="border-b hover:bg-muted/30">
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="p-2">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
