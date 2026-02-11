"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { DynamicNavbar } from "@/components/home/DynamicNavbar";
import { Footer } from "@/components/home/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FolderKanban, Search, Eye, FileText, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "react-toastify";
import { getProjetsForUser } from "@/actions/projets";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
  getFilteredRowModel,
  getPaginationRowModel,
  ColumnFiltersState,
} from "@tanstack/react-table";
import { DataTable } from "@/components/admin/DataTable";

type ProjetData = {
  id: string;
  titre: string;
  description: string;
  statut: string;
  dateDebut: Date | null;
  dateFin: Date | null;
  dateFinReelle: Date | null;
  createdAt: Date;
  updatedAt: Date;
  CreatedBy: {
    id: string;
    name: string | null;
    email: string | null;
  };
  _count: {
    SousProjets: number;
  };
};

const columnHelper = createColumnHelper<ProjetData>();

const getStatutBadgeColor = (statut: string) => {
  switch (statut) {
    case "Planifie":
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700";
    case "EnCours":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800";
    case "EnPause":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800";
    case "Termine":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800";
    case "Annule":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700";
  }
};

export default function UserProjetsPage() {
  const [data, setData] = useState<ProjetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statutFilter, setStatutFilter] = useState<string>("all");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getProjetsForUser();
      if (result.success && result.data) {
        setData(result.data);
      } else {
        toast.error(result.error || "Erreur lors du chargement des projets");
      }
    } catch (error) {
      console.error("Erreur lors du chargement:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const timer = setTimeout(() => setGlobalFilter(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      if (globalFilter.trim()) {
        const q = globalFilter.trim().toLowerCase();
        const searchText = [
          item.titre || "",
          item.description || "",
          item.CreatedBy?.name || "",
          item.CreatedBy?.email || "",
        ]
          .join(" ")
          .toLowerCase();
        if (!searchText.includes(q)) return false;
      }
      if (statutFilter !== "all" && item.statut !== statutFilter) return false;
      return true;
    });
  }, [data, globalFilter, statutFilter]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("titre", {
        header: "Titre",
        cell: ({ row }) => (
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {row.getValue("titre")}
          </span>
        ),
        size: 250,
      }),
      columnHelper.accessor("description", {
        header: "Description",
        cell: ({ row }) => (
          <span className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {row.getValue("description")}
          </span>
        ),
        size: 300,
      }),
      columnHelper.accessor("statut", {
        header: "Statut",
        cell: ({ row }) => {
          const statut = row.getValue("statut");
          return (
            <Badge className={`${getStatutBadgeColor(statut)} text-xs border`}>
              {statut}
            </Badge>
          );
        },
        size: 120,
      }),
      columnHelper.accessor("dateDebut", {
        header: "Date début",
        cell: ({ row }) => {
          const date = row.getValue("dateDebut");
          return (
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {date ? format(new Date(date), "dd/MM/yyyy", { locale: fr }) : "—"}
            </span>
          );
        },
        size: 120,
      }),
      columnHelper.accessor("dateFin", {
        header: "Date fin",
        cell: ({ row }) => {
          const date = row.getValue("dateFin");
          return (
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {date ? format(new Date(date), "dd/MM/yyyy", { locale: fr }) : "—"}
            </span>
          );
        },
        size: 120,
      }),
      columnHelper.display({
        id: "taches",
        header: "Tâches",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <FileText className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {row.original._count?.SousProjets ?? 0}
            </span>
          </div>
        ),
        size: 100,
      }),
      columnHelper.accessor("CreatedBy", {
        header: "Créé par",
        cell: ({ row }) => (
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {row.getValue("CreatedBy")?.name ||
              row.getValue("CreatedBy")?.email ||
              "—"}
          </span>
        ),
        size: 150,
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Link href={`/user/projets/${row.original.id}`}>
            <Button
              variant="outline"
              size="sm"
              className="border-blue-300 hover:bg-blue-50"
              title="Voir le détail"
            >
              <Eye className="h-4 w-4 mr-1" />
              Voir
            </Button>
          </Link>
        ),
        size: 100,
      }),
    ],
    []
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    initialState: { pagination: { pageSize: 10 } },
    state: { sorting, columnFilters, globalFilter },
    defaultColumn: { minSize: 50, maxSize: 800 },
  });

  const stats = useMemo(() => {
    const total = data.length;
    const enCours = data.filter((p) => p.statut === "EnCours").length;
    const termines = data.filter((p) => p.statut === "Termine").length;
    const totalTaches = data.reduce((sum, p) => sum + (p._count?.SousProjets ?? 0), 0);
    return { total, enCours, termines, totalTaches };
  }, [data]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <DynamicNavbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="mx-auto max-w-7xl shadow-lg border-blue-200 dark:border-gray-700 !pt-0">
          <CardHeader className="bg-gradient-to-r from-blue-500/90 via-blue-400/80 to-blue-500/90 dark:from-blue-700/50 dark:via-blue-600/40 dark:to-blue-700/50 text-white !pt-0 rounded-t-lg">
            <div className="flex items-center justify-between pt-4 sm:pt-6 pb-4 sm:pb-6">
              <CardTitle className="flex items-center gap-2">
                <FolderKanban className="h-5 w-5" />
                Projets Amaki ({stats.total})
              </CardTitle>
              <Link href="/user/profile">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white/10 hover:bg-white/20 border-white/30 text-white hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Retour au profil
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
                <CardContent className="p-3">
                  <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Total</div>
                  <div className="text-lg font-bold text-blue-900 dark:text-blue-100">{stats.total}</div>
                </CardContent>
              </Card>
              <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
                <CardContent className="p-3">
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">En cours</div>
                  <div className="text-lg font-bold text-emerald-900 dark:text-emerald-100">{stats.enCours}</div>
                </CardContent>
              </Card>
              <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
                <CardContent className="p-3">
                  <div className="text-xs text-green-600 dark:text-green-400 font-semibold">Terminés</div>
                  <div className="text-lg font-bold text-green-900 dark:text-green-100">{stats.termines}</div>
                </CardContent>
              </Card>
              <Card className="border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20">
                <CardContent className="p-3">
                  <div className="text-xs text-purple-600 dark:text-purple-400 font-semibold">Total tâches</div>
                  <div className="text-lg font-bold text-purple-900 dark:text-purple-100">{stats.totalTaches}</div>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher par titre, description, créateur..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statutFilter} onValueChange={setStatutFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="Planifie">Planifié</SelectItem>
                  <SelectItem value="EnCours">En cours</SelectItem>
                  <SelectItem value="EnPause">En pause</SelectItem>
                  <SelectItem value="Termine">Terminé</SelectItem>
                  <SelectItem value="Annule">Annulé</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <>
                <div className="mb-4 text-sm text-gray-600 dark:text-gray-300">
                  {filteredData.length} projet(s) trouvé(s)
                </div>
                <DataTable table={table} emptyMessage="Aucun projet trouvé" />
                <div className="hidden md:flex mt-5 flex-col sm:flex-row items-center justify-between py-5 gap-4">
                  <div className="text-sm text-muted-foreground dark:text-gray-400">
                    {table.getFilteredRowModel().rows.length} projet(s) au total
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
                    <span className="text-sm">
                      Page {table.getState().pagination.pageIndex + 1} sur {table.getPageCount() || 1}
                    </span>
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
              </>
            )}
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
