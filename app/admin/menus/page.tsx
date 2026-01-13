"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Menu as MenuIcon,
  Search,
  Plus,
  Eye,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
  getFilteredRowModel,
  getPaginationRowModel,
  ColumnFiltersState,
  VisibilityState,
} from "@tanstack/react-table";
import { DataTable } from "@/components/admin/DataTable";
import { ColumnVisibilityToggle } from "@/components/admin/ColumnVisibilityToggle";
import { getAllMenus, toggleMenuStatus, deleteMenu } from "@/actions/menus";
import { toast } from "react-toastify";
import Link from "next/link";

interface Menu {
  id: string;
  libelle: string;
  description: string | null;
  lien: string;
  niveau: "NAVBAR" | "SIDEBAR";
  roles: string[];
  icone: string | null;
  statut: boolean;
  ordre: number;
  parent: string | null;
  electoral: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  CreatedBy?: {
    name: string | null;
    email: string | null;
  } | null;
}

const columnHelper = createColumnHelper<Menu>();

export default function AdminMenusPage() {
  const router = useRouter();
  const [data, setData] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [niveauFilter, setNiveauFilter] = useState<string>("all");
  const [statutFilter, setStatutFilter] = useState<string>("all");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("admin-menus-column-visibility");
        if (saved) return JSON.parse(saved);
      } catch (error) {
        console.error("Erreur lors du chargement des préférences:", error);
      }
      
      // Configuration par défaut pour mobile (masquer certaines colonnes)
      const isMobile = window.innerWidth < 768; // breakpoint md de Tailwind
      if (isMobile) {
        return {
          ordre: false,
          lien: false,
          roles: false,
          icone: false,
          electoral: false,
          statut: false,
        };
      }
    }
    return {};
  });

  // Debounce pour la recherche
  useEffect(() => {
    const timer = setTimeout(() => {
      setGlobalFilter(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Gérer la visibilité des colonnes selon la taille d'écran
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      const saved = localStorage.getItem("admin-menus-column-visibility");
      
      // Ne modifier que si aucune préférence utilisateur n'est sauvegardée
      if (!saved) {
        if (isMobile) {
          setColumnVisibility({
            ordre: false,
            lien: false,
            roles: false,
            icone: false,
            electoral: false,
            statut: false,
          });
        } else {
          setColumnVisibility({});
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getAllMenus();
      if (res.success && res.data) {
        setData(res.data as Menu[]);
      } else {
        toast.error(res.error || "Erreur lors du chargement des menus");
      }
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors du chargement des menus");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtrer les données
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      // Filtre global (recherche)
      if (globalFilter.trim()) {
        const q = globalFilter.trim().toLowerCase();
        const searchText = [
          item.libelle || "",
          item.description || "",
          item.lien || "",
          item.niveau || "",
          ...(item.roles || []),
        ]
          .join(" ")
          .toLowerCase();
        if (!searchText.includes(q)) return false;
      }

      // Filtre par niveau
      if (niveauFilter !== "all" && item.niveau !== niveauFilter) {
        return false;
      }

      // Filtre par statut
      if (statutFilter !== "all") {
        if (statutFilter === "actif" && !item.statut) return false;
        if (statutFilter === "inactif" && item.statut) return false;
      }

      return true;
    });
  }, [data, globalFilter, niveauFilter, statutFilter]);

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    const result = await toggleMenuStatus(id, !currentStatus);
    if (result.success) {
      toast.success(result.message);
      loadData();
    } else {
      toast.error(result.error || "Erreur");
    }
  };

  const handleDelete = async (id: string, libelle: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le menu "${libelle}" ?`)) {
      return;
    }

    const result = await deleteMenu(id);
    if (result.success) {
      toast.success(result.message);
      loadData();
    } else {
      toast.error(result.error || "Erreur");
    }
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor("ordre", {
        header: "Ordre",
        cell: ({ row }) => (
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {row.getValue("ordre")}
          </span>
        ),
        size: 80,
        minSize: 60,
        maxSize: 100,
        enableResizing: true,
      }),
      columnHelper.accessor("libelle", {
        header: "Libellé",
        cell: ({ row }) => (
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {row.getValue("libelle")}
          </span>
        ),
        size: 200,
        minSize: 150,
        maxSize: 300,
        enableResizing: true,
      }),
      columnHelper.accessor("lien", {
        header: "Lien",
        cell: ({ row }) => (
          <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
            {row.getValue("lien")}
          </code>
        ),
        size: 200,
        minSize: 150,
        maxSize: 300,
        enableResizing: true,
      }),
      columnHelper.accessor("niveau", {
        header: "Niveau",
        cell: ({ row }) => {
          const niveau = row.getValue("niveau") as string;
          return (
            <span
              className={`text-xs px-2 py-1 rounded-full font-medium ${
                niveau === "NAVBAR"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                  : "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
              }`}
            >
              {niveau}
            </span>
          );
        },
        size: 120,
        minSize: 100,
        maxSize: 150,
        enableResizing: true,
      }),
      columnHelper.accessor("roles", {
        header: "Rôles",
        cell: ({ row }) => {
          const roles = row.getValue("roles") as string[];
          return (
            <div className="flex flex-wrap gap-1">
              {roles.map((role) => (
                <span
                  key={role}
                  className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded"
                >
                  {role}
                </span>
              ))}
            </div>
          );
        },
        size: 200,
        minSize: 150,
        maxSize: 300,
        enableResizing: true,
      }),
      columnHelper.accessor("icone", {
        header: "Icône",
        cell: ({ row }) => (
          <code className="text-xs text-gray-600 dark:text-gray-400">
            {row.getValue("icone") || "-"}
          </code>
        ),
        size: 120,
        minSize: 80,
        maxSize: 150,
        enableResizing: true,
      }),
      columnHelper.accessor("electoral", {
        header: "Électoral",
        cell: ({ row }) => {
          const electoral = row.getValue("electoral") as boolean;
          return electoral ? (
            <span className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 px-2 py-1 rounded-full font-medium">
              Oui
            </span>
          ) : (
            <span className="text-xs text-gray-500">-</span>
          );
        },
        size: 100,
        minSize: 80,
        maxSize: 120,
        enableResizing: true,
      }),
      columnHelper.accessor("statut", {
        header: "Statut",
        cell: ({ row }) => {
          const statut = row.getValue("statut") as boolean;
          return (
            <span
              className={`text-xs px-2 py-1 rounded-full font-medium ${
                statut
                  ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                  : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
              }`}
            >
              {statut ? "Actif" : "Inactif"}
            </span>
          );
        },
        size: 100,
        minSize: 80,
        maxSize: 120,
        enableResizing: true,
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        meta: { forceVisible: true },
        enableResizing: false,
        cell: ({ row }) => {
          const item = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-8 w-8 p-0"
                >
                  <span className="sr-only">Ouvrir le menu</span>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => router.push(`/admin/menus/${item.id}`)}
                  className="cursor-pointer"
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Modifier
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleToggleStatus(item.id, item.statut)}
                  className="cursor-pointer"
                >
                  {item.statut ? (
                    <>
                      <PowerOff className="mr-2 h-4 w-4" />
                      Désactiver
                    </>
                  ) : (
                    <>
                      <Power className="mr-2 h-4 w-4" />
                      Activer
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleDelete(item.id, item.libelle)}
                  className="cursor-pointer text-red-600 focus:text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        size: 80,
        minSize: 60,
        maxSize: 100,
      }),
    ],
    [handleToggleStatus, handleDelete]
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
    onColumnVisibilityChange: (updater) => {
      const newVisibility =
        typeof updater === "function" ? updater(columnVisibility) : updater;
      setColumnVisibility(newVisibility);
      try {
        localStorage.setItem(
          "admin-menus-column-visibility",
          JSON.stringify(newVisibility)
        );
      } catch (error) {
        console.error("Erreur lors de la sauvegarde des préférences:", error);
      }
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
    state: { sorting, columnFilters, globalFilter, columnVisibility },
    defaultColumn: {
      minSize: 50,
      maxSize: 800,
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <Card className="mx-auto max-w-7xl shadow-lg border-blue-200 dark:border-slate-700 !py-0">
        <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white !p-0">
          <div className="flex items-center justify-between px-6 py-4">
            <CardTitle className="flex items-center gap-2 !p-0">
              <MenuIcon className="h-6 w-6" />
              Gestion des Menus ({filteredData.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              <ColumnVisibilityToggle
                table={table}
                storageKey="admin-menus-column-visibility"
              />
              <Link href="/admin/menus/create">
                <Button className="bg-white text-blue-600 hover:bg-blue-50">
                  <Plus className="h-4 w-4 mr-2" />
                  Nouveau Menu
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* Filtres et recherche */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher un menu..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-11"
              />
            </div>
            <Select value={niveauFilter} onValueChange={setNiveauFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrer par niveau" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les niveaux</SelectItem>
                <SelectItem value="NAVBAR">NAVBAR</SelectItem>
                <SelectItem value="SIDEBAR">SIDEBAR</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statutFilter} onValueChange={setStatutFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="actif">Actifs</SelectItem>
                <SelectItem value="inactif">Inactifs</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              <div className="mb-4 text-sm text-gray-600 dark:text-gray-300">
                {filteredData.length} menu(s) trouvé(s)
              </div>
              <DataTable
                table={table}
                emptyMessage="Aucun menu trouvé"
                compact={true}
              />

              {/* Pagination */}
              <div className="bg-white dark:bg-gray-800 mt-5 flex items-center justify-between py-5 font-semibold rounded-xl shadow-xl border border-gray-200 dark:border-gray-700">
                <div className="ml-5 mt-2 flex-1 text-sm text-muted-foreground dark:text-gray-400">
                  {table.getFilteredRowModel().rows.length} ligne(s) au total
                </div>

                <div className="flex items-center space-x-6 lg:space-x-8">
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Lignes par page
                    </p>
                    <Select
                      value={`${table.getState().pagination.pageSize}`}
                      onValueChange={(value) => {
                        table.setPageSize(Number(value));
                      }}
                    >
                      <SelectTrigger className="h-8 w-[70px]">
                        <SelectValue
                          placeholder={table.getState().pagination.pageSize}
                        />
                      </SelectTrigger>
                      <SelectContent side="top">
                        {[10, 20, 30, 40, 50].map((pageSize) => (
                          <SelectItem key={pageSize} value={`${pageSize}`}>
                            {pageSize}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex w-[100px] items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-300">
                    Page {table.getState().pagination.pageIndex + 1} sur{" "}
                    {table.getPageCount()}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      className="hidden h-8 w-8 p-0 lg:flex"
                      onClick={() => table.setPageIndex(0)}
                      disabled={!table.getCanPreviousPage()}
                    >
                      <span className="sr-only">Aller à la première page</span>
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => table.previousPage()}
                      disabled={!table.getCanPreviousPage()}
                    >
                      <span className="sr-only">Page précédente</span>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => table.nextPage()}
                      disabled={!table.getCanNextPage()}
                    >
                      <span className="sr-only">Page suivante</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="hidden h-8 w-8 p-0 lg:flex"
                      onClick={() =>
                        table.setPageIndex(table.getPageCount() - 1)
                      }
                      disabled={!table.getCanNextPage()}
                    >
                      <span className="sr-only">Aller à la dernière page</span>
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
