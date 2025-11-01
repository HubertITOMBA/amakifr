"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, Plus, Eye, Edit, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { getAllEvenements, deleteEvenement } from "@/actions/evenements";
import { toast } from "sonner";
import { createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, useReactTable, SortingState, ColumnFiltersState } from "@tanstack/react-table";
import type { EvenementData } from "@/actions/evenements";

const columnHelper = createColumnHelper<EvenementData>();

const getStatusColor = (statut: string) => {
  switch (statut) {
    case "Publie":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "Archive":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "Brouillon":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  }
};

const getStatusLabel = (statut: string) => {
  switch (statut) {
    case "Publie":
      return "Publié";
    case "Archive":
      return "Archivé";
    case "Brouillon":
      return "Brouillon";
    default:
      return statut;
  }
};

export default function AdminEvenementsPage() {
  const router = useRouter();
  const [evenements, setEvenements] = useState<EvenementData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const loadAll = async () => {
    const res = await getAllEvenements();
    if (res.success && res.data) {
      setEvenements(res.data as any);
    }
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
    if (!confirm("Supprimer cet événement ?")) return;
    const res = await deleteEvenement(id);
    if (res.success) {
      toast.success("Événement supprimé");
      await loadAll();
    } else {
      toast.error(res.error || "Erreur lors de la suppression");
    }
  };

  const columns = useMemo(() => [
    columnHelper.accessor("titre", {
      header: "Titre",
      cell: info => <div className="font-medium">{info.getValue()}</div>,
    }),
    columnHelper.accessor("dateDebut", {
      header: "Date de début",
      cell: info => <div className="text-sm">{new Date(info.getValue()).toLocaleDateString('fr-FR')}</div>,
    }),
    columnHelper.accessor("categorie", {
      header: "Catégorie",
      cell: info => <Badge variant="outline">{info.getValue()}</Badge>,
    }),
    columnHelper.accessor("statut", {
      header: "Statut",
      cell: info => <Badge className={`${getStatusColor(info.getValue())} text-xs`}>{getStatusLabel(info.getValue())}</Badge>,
    }),
    columnHelper.accessor((row) => (row as any).Inscriptions?.length || 0, {
      id: "inscriptions",
      header: "Inscriptions",
      cell: info => <div className="text-sm">{info.getValue()}</div>,
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const e = row.original;
        return (
          <div className="flex space-x-2">
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => router.push(`/admin/evenements/${e.id}/consultation`)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => router.push(`/admin/evenements/${e.id}/edition`)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleDelete(e.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    }),
  ], []);

  const table = useReactTable({
    data: evenements.filter(e => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return [
        e.titre || "",
        e.description || "",
        e.categorie || "",
        e.statut || "",
        e.lieu || "",
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
              <Calendar className="h-5 w-5 mr-2" />
              Gestion des Événements
            </span>
            <div className="flex items-center gap-2">
              <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
              <Button onClick={() => router.push("/admin/evenements/gestion")}>
                <Plus className="h-4 w-4 mr-2" />
                Nouvel événement
              </Button>
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
