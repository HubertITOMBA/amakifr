"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  SortingState,
  ColumnFiltersState,
  useReactTable,
} from "@tanstack/react-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Receipt, 
  Euro, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Search, 
  Filter,
  Download,
  Eye,
  Edit,
  Trash2,
  Plus,
  Upload,
  Calendar,
  DollarSign
} from "lucide-react";
import { toast } from "sonner";
import { getAllDepenses, createDepense, updateDepense, deleteDepense, getDepenseStats, filterDepenses } from "@/actions/depenses";

interface Depense {
  id: string;
  libelle: string;
  montant: number;
  dateDepense: string;
  categorie: string;
  description?: string;
  justificatif?: string;
  statut: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  CreatedBy: {
    id: string;
    email: string;
  };
}

interface DepenseStats {
  totalDepenses: number;
  depensesMois: number;
  depensesEnAttente: number;
  totalMontantMois: number;
  totalMontantGlobal: number;
}

export default function AdminDepenseManagement() {
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [filteredDepenses, setFilteredDepenses] = useState<Depense[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DepenseStats | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingDepense, setEditingDepense] = useState<Depense | null>(null);
  const [formData, setFormData] = useState({
    libelle: "",
    montant: 0,
    dateDepense: new Date().toISOString().split('T')[0],
    categorie: "",
    description: "",
    justificatif: "",
    statut: "EnAttente",
  });
  const [isFiltering, setIsFiltering] = useState(false);

  const categories = [
    "Frais de fonctionnement",
    "Événements",
    "Matériel",
    "Communication",
    "Formation",
    "Transport",
    "Autres"
  ];

  useEffect(() => {
    loadDepenses();
    loadStats();
  }, []);

  useEffect(() => {
    setFilteredDepenses(depenses);
  }, [depenses]);

  const loadDepenses = async () => {
    try {
      setLoading(true);
      const result = await getAllDepenses();
      if (result.success) {
        setDepenses(result.data);
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("Erreur lors du chargement des dépenses");
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const result = await getDepenseStats();
      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des statistiques:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let result;
      if (editingDepense) {
        result = await updateDepense({
          id: editingDepense.id,
          ...formData,
        });
      } else {
        result = await createDepense(formData);
      }

      if (result.success) {
        toast.success(editingDepense ? "Dépense mise à jour" : "Dépense créée");
        setShowForm(false);
        setEditingDepense(null);
        setFormData({
          libelle: "",
          montant: 0,
          dateDepense: new Date().toISOString().split('T')[0],
          categorie: "",
          description: "",
          justificatif: "",
          statut: "EnAttente",
        });
        loadDepenses();
        loadStats();
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette dépense ?")) return;

    try {
      const result = await deleteDepense(id);
      if (result.success) {
        toast.success("Dépense supprimée");
        loadDepenses();
        loadStats();
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleFilter = async () => {
    setIsFiltering(true);
    try {
      const result = await filterDepenses({
        categorie: (table.getColumn("categorie")?.getFilterValue() as string) || undefined,
        statut: (table.getColumn("statut")?.getFilterValue() as string) || undefined,
        searchTerm: globalFilter || undefined,
      });

      if (result.success) {
        setFilteredDepenses(result.data);
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("Erreur lors du filtrage");
    } finally {
      setIsFiltering(false);
    }
  };

  const columns: ColumnDef<Depense>[] = useMemo(
    () => [
      {
        accessorKey: "libelle",
        header: "Libellé",
        cell: ({ row }) => (
          <div className="font-medium text-gray-900 dark:text-white">
            {row.getValue("libelle")}
          </div>
        ),
      },
      {
        accessorKey: "montant",
        header: "Montant",
        cell: ({ row }) => (
          <div className="text-right">
            <span className="font-bold text-gray-900 dark:text-white">
              {Number(row.getValue("montant")).toFixed(2).replace('.', ',')} €
            </span>
          </div>
        ),
      },
      {
        accessorKey: "dateDepense",
        header: "Date",
        cell: ({ row }) => (
          <div className="text-sm text-gray-500">
            {new Date(row.getValue("dateDepense")).toLocaleDateString('fr-FR')}
          </div>
        ),
      },
      {
        accessorKey: "categorie",
        header: "Catégorie",
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs">
            {row.getValue("categorie")}
          </Badge>
        ),
      },
      {
        accessorKey: "statut",
        header: "Statut",
        cell: ({ row }) => {
          const statut = row.getValue("statut") as string;
          const colors = {
            EnAttente: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
            Valide: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
            Rejete: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
          };
          return (
            <Badge className={colors[statut as keyof typeof colors] || "bg-gray-100 text-gray-800"}>
              {statut}
            </Badge>
          );
        },
      },
      {
        accessorKey: "justificatif",
        header: "Justificatif",
        cell: ({ row }) => {
          const justificatif = row.getValue("justificatif") as string;
          return justificatif ? (
            <div className="flex items-center space-x-2">
              <Upload className="h-4 w-4 text-green-600" />
              <a 
                href={justificatif} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                Voir
              </a>
            </div>
          ) : (
            <span className="text-gray-400 text-sm">Aucun</span>
          );
        },
      },
      {
        accessorKey: "CreatedBy.email",
        header: "Créé par",
        cell: ({ row }) => (
          <div className="text-sm text-gray-500">
            {row.original.CreatedBy.email}
          </div>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const depense = row.original;
          return (
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingDepense(depense);
                  setFormData({
                    libelle: depense.libelle,
                    montant: depense.montant,
                    dateDepense: new Date(depense.dateDepense).toISOString().split('T')[0],
                    categorie: depense.categorie,
                    description: depense.description || "",
                    justificatif: depense.justificatif || "",
                    statut: depense.statut,
                  });
                  setShowForm(true);
                }}
                className="text-blue-600 hover:text-blue-700"
              >
                <Edit className="h-3 w-3 mr-1" />
                Modifier
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDelete(depense.id)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Supprimer
              </Button>
            </div>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: filteredDepenses,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
  });

  if (loading && depenses.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <Clock className="h-5 w-5 animate-spin text-blue-600" />
          <span className="text-gray-600">Chargement des dépenses...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Gestion des Dépenses
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Suivi et gestion des dépenses de l'association
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingDepense(null);
            setFormData({
              libelle: "",
              montant: 0,
              dateDepense: new Date().toISOString().split('T')[0],
              categorie: "",
              description: "",
              justificatif: "",
              statut: "EnAttente",
            });
            setShowForm(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle Dépense
        </Button>
      </div>

      {/* Statistiques */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Total Dépenses
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.totalDepenses}
                  </p>
                </div>
                <Receipt className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Ce Mois
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    {stats.depensesMois}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    En Attente
                  </p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {stats.depensesEnAttente}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Montant Mois
                  </p>
                  <p className="text-2xl font-bold text-orange-600">
                    {stats.totalMontantMois.toFixed(2).replace('.', ',')} €
                  </p>
                </div>
                <Euro className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Total Global
                  </p>
                  <p className="text-2xl font-bold text-purple-600">
                    {stats.totalMontantGlobal.toFixed(2).replace('.', ',')} €
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tableau */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Liste des Dépenses</CardTitle>
              <CardDescription>
                Gestion et suivi des dépenses de l'association
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exporter PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filtres */}
          <div className="flex items-center space-x-4 mb-4">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher une dépense..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Select
              value={(table.getColumn("categorie")?.getFilterValue() as string) ?? ""}
              onValueChange={(value) =>
                table.getColumn("categorie")?.setFilterValue(value === "all" ? "" : value)
              }
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {categories.map((categorie) => (
                  <SelectItem key={categorie} value={categorie}>
                    {categorie}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={(table.getColumn("statut")?.getFilterValue() as string) ?? ""}
              onValueChange={(value) =>
                table.getColumn("statut")?.setFilterValue(value === "all" ? "" : value)
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="EnAttente">En Attente</SelectItem>
                <SelectItem value="Valide">Validé</SelectItem>
                <SelectItem value="Rejete">Rejeté</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={handleFilter}
              disabled={isFiltering}
              variant="outline"
              size="sm"
            >
              {isFiltering ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Filtrage...
                </>
              ) : (
                <>
                  <Filter className="h-4 w-4 mr-2" />
                  Filtrer
                </>
              )}
            </Button>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <table className="w-full">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="border-b bg-gray-50 dark:bg-gray-800">
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-4 whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-500">
              {table.getFilteredRowModel().rows.length} dépense(s) au total
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Précédent
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Suivant
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal de création/édition */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>
                {editingDepense ? "Modifier la Dépense" : "Nouvelle Dépense"}
              </CardTitle>
              <CardDescription>
                {editingDepense ? "Modifier les informations de la dépense" : "Ajouter une nouvelle dépense"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="libelle">Libellé *</Label>
                    <Input
                      id="libelle"
                      value={formData.libelle}
                      onChange={(e) => setFormData({ ...formData, libelle: e.target.value })}
                      placeholder="Libellé de la dépense"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="montant">Montant *</Label>
                    <div className="relative">
                      <Input
                        id="montant"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.montant}
                        onChange={(e) => setFormData({ ...formData, montant: parseFloat(e.target.value) })}
                        placeholder="0.00"
                        required
                      />
                      <Euro className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dateDepense">Date *</Label>
                    <Input
                      id="dateDepense"
                      type="date"
                      value={formData.dateDepense}
                      onChange={(e) => setFormData({ ...formData, dateDepense: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="categorie">Catégorie *</Label>
                    <Select
                      value={formData.categorie}
                      onValueChange={(value) => setFormData({ ...formData, categorie: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner une catégorie" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((categorie) => (
                          <SelectItem key={categorie} value={categorie}>
                            {categorie}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="statut">Statut</Label>
                    <Select
                      value={formData.statut}
                      onValueChange={(value) => setFormData({ ...formData, statut: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EnAttente">En Attente</SelectItem>
                        <SelectItem value="Valide">Validé</SelectItem>
                        <SelectItem value="Rejete">Rejeté</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="justificatif">Justificatif (URL)</Label>
                    <Input
                      id="justificatif"
                      value={formData.justificatif}
                      onChange={(e) => setFormData({ ...formData, justificatif: e.target.value })}
                      placeholder="URL du fichier justificatif"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Description détaillée de la dépense"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    rows={3}
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowForm(false)}
                  >
                    Annuler
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {loading ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Sauvegarde...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        {editingDepense ? "Modifier" : "Créer"}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
