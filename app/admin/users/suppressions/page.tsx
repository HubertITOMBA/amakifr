"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  ArrowLeft,
  Calendar,
  User,
  Mail,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { getSuppressionsHistory, getSuppressionsStats } from "@/actions/user/get-suppressions-history";
import { DataTable } from "@/components/admin/DataTable";
import { ColumnVisibilityToggle } from "@/components/admin/ColumnVisibilityToggle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { UserRole } from "@prisma/client";

type SuppressionData = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string | null;
  userRole: UserRole;
  adherentFirstName: string | null;
  adherentLastName: string | null;
  reason: string;
  notifyUser: boolean;
  deletedBy: string;
  deletedByName: string;
  deletedByEmail: string | null;
  createdAt: Date;
  DeletedBy: {
    id: string;
    name: string | null;
    email: string | null;
  };
};

const columnHelper = createColumnHelper<SuppressionData>();

export default function AdminSuppressionsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [suppressions, setSuppressions] = useState<SuppressionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    last30Days: 0,
    last7Days: 0,
    withNotification: 0,
    withoutNotification: 0,
  });

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("admin-suppressions-column-visibility");
        if (saved) return JSON.parse(saved);
      } catch (error) {
        console.error("Erreur lors du chargement des préférences:", error);
      }
    }
    return {};
  });

  // Debounce pour la recherche
  useEffect(() => {
    const timer = setTimeout(() => {
      setGlobalFilter(searchTerm);
      setPage(1); // Réinitialiser à la page 1 lors d'une nouvelle recherche
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadData = useCallback(async () => {
    if (sessionStatus === "loading") return;

    if (!session?.user || session.user.role !== "Admin") {
      router.push("/");
      return;
    }

    try {
      setLoading(true);
      const [historyResult, statsResult] = await Promise.all([
        getSuppressionsHistory(page, pageSize, globalFilter || undefined),
        getSuppressionsStats(),
      ]);

      if (historyResult.success && historyResult.data) {
        setSuppressions(historyResult.data);
        setTotal(historyResult.pagination?.total || 0);
      }

      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des données:", error);
    } finally {
      setLoading(false);
    }
  }, [session, sessionStatus, router, page, pageSize, globalFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredData = useMemo(() => {
    return suppressions.filter((item) => {
      if (globalFilter.trim()) {
        const q = globalFilter.trim().toLowerCase();
        const searchText = [
          item.userName || "",
          item.userEmail || "",
          item.adherentFirstName || "",
          item.adherentLastName || "",
          item.reason || "",
          item.deletedByName || "",
        ]
          .join(" ")
          .toLowerCase();
        if (!searchText.includes(q)) return false;
      }
      return true;
    });
  }, [suppressions, globalFilter]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("createdAt", {
        header: () => <div className="text-center w-full">Date</div>,
        cell: ({ row }) => {
          const date = new Date(row.getValue("createdAt"));
          return (
            <div className="text-center">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {format(date, "dd/MM/yyyy", { locale: fr })}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {format(date, "HH:mm", { locale: fr })}
              </div>
            </div>
          );
        },
        size: 120,
        minSize: 100,
        maxSize: 150,
        enableResizing: true,
      }),
      columnHelper.accessor("userName", {
        header: () => <div className="text-center w-full">Adhérent supprimé</div>,
        cell: ({ row }) => {
          const item = row.original;
          const fullName =
            item.adherentFirstName && item.adherentLastName
              ? `${item.adherentFirstName} ${item.adherentLastName}`
              : item.userName;
          return (
            <div className="text-center">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center justify-center gap-2">
                <User className="h-4 w-4 text-gray-400" />
                {fullName}
              </div>
              {item.userEmail && (
                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1 mt-1">
                  <Mail className="h-3 w-3" />
                  {item.userEmail}
                </div>
              )}
            </div>
          );
        },
        size: 200,
        minSize: 150,
        maxSize: 300,
        enableResizing: true,
      }),
      columnHelper.accessor("userRole", {
        header: () => <div className="text-center w-full">Rôle</div>,
        cell: ({ row }) => {
          const role = row.getValue("userRole") as UserRole;
          const roleColors: Record<UserRole, string> = {
            Admin: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
            Membre: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
            Invite: "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400",
          };
          return (
            <div className="text-center">
              <Badge className={roleColors[role] || ""}>{role}</Badge>
            </div>
          );
        },
        size: 100,
        minSize: 80,
        maxSize: 120,
        enableResizing: true,
      }),
      columnHelper.accessor("reason", {
        header: () => <div className="text-center w-full">Raison</div>,
        cell: ({ row }) => {
          const reason = row.getValue("reason") as string;
          return (
            <div className="text-center max-w-xs mx-auto">
              <div className="text-sm text-gray-900 dark:text-gray-100 line-clamp-2" title={reason}>
                {reason}
              </div>
            </div>
          );
        },
        size: 250,
        minSize: 200,
        maxSize: 400,
        enableResizing: true,
      }),
      columnHelper.accessor("notifyUser", {
        header: () => <div className="text-center w-full">Notification</div>,
        cell: ({ row }) => {
          const notified = row.getValue("notifyUser") as boolean;
          return (
            <div className="text-center">
              {notified ? (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 flex items-center gap-1 justify-center">
                  <CheckCircle2 className="h-3 w-3" />
                  Oui
                </Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400 flex items-center gap-1 justify-center">
                  <XCircle className="h-3 w-3" />
                  Non
                </Badge>
              )}
            </div>
          );
        },
        size: 120,
        minSize: 100,
        maxSize: 150,
        enableResizing: true,
      }),
      columnHelper.accessor("deletedByName", {
        header: () => <div className="text-center w-full">Supprimé par</div>,
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="text-center">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {item.deletedByName}
              </div>
              {item.deletedByEmail && (
                <div className="text-xs text-gray-500 dark:text-gray-400">{item.deletedByEmail}</div>
              )}
            </div>
          );
        },
        size: 180,
        minSize: 150,
        maxSize: 250,
        enableResizing: true,
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
    onColumnVisibilityChange: (updater) => {
      const newVisibility = typeof updater === "function" ? updater(columnVisibility) : updater;
      setColumnVisibility(newVisibility);
      try {
        localStorage.setItem("admin-suppressions-column-visibility", JSON.stringify(newVisibility));
      } catch (error) {
        console.error("Erreur lors de la sauvegarde des préférences:", error);
      }
    },
    initialState: {
      pagination: {
        pageSize: 20,
      },
    },
    state: { sorting, columnFilters, globalFilter, columnVisibility },
    defaultColumn: {
      minSize: 50,
      maxSize: 800,
    },
  });

  if (sessionStatus === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <Card className="mx-auto max-w-7xl shadow-lg border-blue-200 dark:border-gray-700 !pt-0">
          <CardHeader className="bg-gradient-to-r from-red-500/90 via-red-400/80 to-red-500/90 dark:from-red-700/50 dark:via-red-600/40 dark:to-red-700/50 text-white !pt-0 rounded-t-lg">
            <div className="flex items-center justify-between pt-4 sm:pt-6">
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                Historique des suppressions d'adhérents ({total})
              </CardTitle>
              <Link href="/admin/users">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white/10 hover:bg-white/20 border-white/30 text-white hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Retour
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {/* Statistiques */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
              <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
                </CardContent>
              </Card>
              <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.last30Days}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">30 derniers jours</div>
                </CardContent>
              </Card>
              <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.last7Days}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">7 derniers jours</div>
                </CardContent>
              </Card>
              <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.withNotification}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Avec notification</div>
                </CardContent>
              </Card>
              <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{stats.withoutNotification}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Sans notification</div>
                </CardContent>
              </Card>
            </div>

            {/* Filtres et recherche */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher par nom, email, raison..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <ColumnVisibilityToggle
                table={table}
                storageKey="admin-suppressions-column-visibility"
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <>
                <div className="mb-4 text-sm text-gray-600 dark:text-gray-300">
                  {filteredData.length} suppression(s) trouvée(s)
                </div>
                <DataTable table={table} emptyMessage="Aucune suppression trouvée" compact={true} headerColor="red" />

                {/* Pagination - Masquée sur mobile */}
                <div className="hidden md:flex bg-white dark:bg-gray-800 mt-5 items-center justify-between py-5 font-semibold rounded-xl shadow-xl border border-gray-200 dark:border-gray-700">
                  <div className="ml-5 mt-2 flex-1 text-sm text-muted-foreground dark:text-gray-400">
                    {table.getFilteredRowModel().rows.length} ligne(s) au total
                  </div>

                  <div className="flex items-center space-x-6 lg:space-x-8">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Lignes par page</p>
                      <Select
                        value={`${table.getState().pagination.pageSize}`}
                        onValueChange={(value) => {
                          table.setPageSize(Number(value));
                          setPageSize(Number(value));
                        }}
                      >
                        <SelectTrigger className="h-8 w-[70px]">
                          <SelectValue placeholder={table.getState().pagination.pageSize} />
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
                      Page {table.getState().pagination.pageIndex + 1} sur {table.getPageCount()}
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
                        onClick={() => table.setPageIndex(table.getPageCount() - 1)}
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
    </div>
  );
}
