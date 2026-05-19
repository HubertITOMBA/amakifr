"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LogIn,
  Search,
  RefreshCw,
  Printer,
  Download,
  Award,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
} from "lucide-react";
import { toast } from "react-toastify";
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
import {
  getAdherentConnexionsList,
  syncConnexionBadgesForAll,
  type AdherentConnexionRow,
} from "@/actions/adherent-connexions";
import {
  exportToExcel,
  downloadFile,
  formatDateForExport,
} from "@/lib/utils/export-excel";
import { isAuthorizationError } from "@/lib/utils";
import * as LucideIcons from "lucide-react";

const columnHelper = createColumnHelper<AdherentConnexionRow>();

const BADGE_COLOR_CLASSES: Record<string, string> = {
  blue: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200",
  green: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/40 dark:text-green-200",
  purple: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/40 dark:text-purple-200",
  slate: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200",
  gold: "bg-yellow-100 text-yellow-900 border-yellow-400 dark:bg-yellow-900/40 dark:text-yellow-200",
};

const STORAGE_KEY = "admin-connexions-adherents-column-visibility";

function getDefaultMobileVisibility(): VisibilityState {
  if (typeof window === "undefined") return {};
  if (window.innerWidth >= 768) return {};
  return { civility: false, email: false };
}

function NameCell({ row }: { row: AdherentConnexionRow }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
        {row.firstname} {row.lastname}
      </span>
      <span className="text-xs text-gray-500 dark:text-gray-400 md:hidden truncate">
        {row.loginCount} conn. · {row.badgeNom ?? "Sans badge"}
      </span>
    </div>
  );
}

function BadgeConnexionCell({ row }: { row: AdherentConnexionRow }) {
  if (!row.badgeNom) {
    return <span className="text-xs text-gray-400">—</span>;
  }
  const IconComponent =
    (LucideIcons as Record<string, React.ComponentType<{ className?: string }>>)[
      row.badgeIcone ?? "Award"
    ] || Award;
  const cls =
    BADGE_COLOR_CLASSES[row.badgeCouleur ?? "blue"] ?? BADGE_COLOR_CLASSES.blue;
  return (
    <Badge variant="outline" className={`text-xs gap-1 ${cls}`}>
      <IconComponent className="h-3 w-3" />
      {row.badgeNom}
    </Badge>
  );
}


/**
 * Page admin : connexions des adhérents au portail (hors ADMIN)
 */
export default function AdminConnexionsAdherentsPage() {
  const [data, setData] = useState<AdherentConnexionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([{ id: "loginCount", desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [badgeFilter, setBadgeFilter] = useState<string>("all");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Object.keys(parsed).length > 0) return parsed;
        }
      } catch {
        /* ignore */
      }
      return getDefaultMobileVisibility();
    }
    return {};
  });

  useEffect(() => {
    const timer = setTimeout(() => setGlobalFilter(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const handleResize = () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && Object.keys(JSON.parse(saved)).length > 0) return;
      setColumnVisibility(getDefaultMobileVisibility());
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getAdherentConnexionsList();
      if (result.success && result.data) {
        setData(result.data);
      } else if (result.error && !isAuthorizationError(result.error)) {
        toast.error(result.error);
      }
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors du chargement des connexions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const badgeOptions = useMemo(() => {
    const names = new Set<string>();
    data.forEach((r) => {
      if (r.badgeNom) names.add(r.badgeNom);
    });
    return Array.from(names).sort();
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      if (globalFilter.trim()) {
        const q = globalFilter.trim().toLowerCase();
        const text = [
          item.firstname,
          item.lastname,
          item.civility ?? "",
          item.email ?? "",
          item.badgeNom ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!text.includes(q)) return false;
      }
      if (badgeFilter !== "all") {
        if (badgeFilter === "aucun" && item.badgeNom) return false;
        if (badgeFilter !== "aucun" && item.badgeNom !== badgeFilter) return false;
      }
      return true;
    });
  }, [data, globalFilter, badgeFilter]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("civility", {
        id: "civility",
        header: "Civilité",
        cell: ({ row }) => (
          <span className="text-xs sm:text-sm text-gray-900 dark:text-gray-100">
            {row.original.civility || "—"}
          </span>
        ),
        size: 100,
        minSize: 80,
        maxSize: 140,
      }),
      columnHelper.accessor((row) => `${row.firstname} ${row.lastname}`, {
        id: "name",
        header: "Nom complet",
        cell: ({ row }) => <NameCell row={row.original} />,
        size: 200,
        minSize: 140,
        maxSize: 280,
      }),
      columnHelper.accessor("loginCount", {
        header: "Connexions",
        cell: ({ row }) => (
          <span className="text-sm font-semibold text-blue-700 dark:text-blue-300 font-mono">
            {row.getValue("loginCount")}
          </span>
        ),
        size: 110,
        minSize: 90,
        maxSize: 140,
      }),
      columnHelper.accessor("lastLogin", {
        header: "Dernière connexion",
        cell: ({ row }) => {
          const v = row.getValue("lastLogin") as string | null;
          if (!v) return <span className="text-xs text-gray-400">Jamais</span>;
          return (
            <span className="text-xs sm:text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
              {new Intl.DateTimeFormat("fr-FR", {
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(v))}
            </span>
          );
        },
        size: 160,
        minSize: 130,
        maxSize: 200,
      }),
      columnHelper.accessor("badgeNom", {
        header: "Badge",
        cell: ({ row }) => <BadgeConnexionCell row={row.original} />,
        size: 180,
        minSize: 140,
        maxSize: 240,
        enableSorting: false,
      }),
      columnHelper.accessor("email", {
        header: "Email",
        cell: ({ row }) => (
          <span className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[180px] block">
            {row.original.email || "—"}
          </span>
        ),
        size: 180,
        minSize: 120,
        maxSize: 260,
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
      const next =
        typeof updater === "function" ? updater(columnVisibility) : updater;
      setColumnVisibility(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    initialState: { pagination: { pageSize: 10 } },
    state: { sorting, columnFilters, globalFilter, columnVisibility },
    defaultColumn: { minSize: 50, maxSize: 800 },
  });

  const handleExportExcel = async () => {
    const rows = filteredData.map((r) => ({
      civilite: r.civility ?? "",
      prenom: r.firstname,
      nom: r.lastname,
      connexions: r.loginCount,
      derniereConnexion: r.lastLogin
        ? formatDateForExport(r.lastLogin, "dd/MM/yyyy HH:mm")
        : "Jamais",
      badge: r.badgeNom ?? "Aucun",
      email: r.email ?? "",
    }));

    const result = await exportToExcel(rows, {
      filename: "connexions-adherents",
      sheetName: "Connexions",
      columns: [
        { key: "civilite", label: "Civilité" },
        { key: "prenom", label: "Prénom" },
        { key: "nom", label: "Nom" },
        { key: "connexions", label: "Nombre de connexions" },
        { key: "derniereConnexion", label: "Dernière connexion" },
        { key: "badge", label: "Badge" },
        { key: "email", label: "Email" },
      ],
    });

    if (result.success && result.blob) {
      downloadFile(
        result.blob,
        `connexions-adherents_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
      toast.success("Export Excel téléchargé");
    } else {
      toast.error(result.error || "Erreur lors de l'export Excel");
    }
  };

  const handleSyncBadges = async () => {
    setSyncing(true);
    try {
      const result = await syncConnexionBadgesForAll();
      if (result.success) {
        toast.success(result.message || "Badges synchronisés");
        await loadData();
      } else {
        toast.error(result.error || "Synchronisation impossible");
      }
    } finally {
      setSyncing(false);
    }
  };

  const headerBtn =
    "bg-white dark:bg-gray-800 border-white/40 dark:border-gray-600 text-gray-800 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-gray-700";

  return (
    <>
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
        }
        .print-only {
          display: none;
        }
      `}</style>

      <div className="print-only p-6">
        <h1 className="text-xl font-bold mb-2">Connexions adhérents au portail</h1>
        <p className="text-sm text-gray-600 mb-4">
          Généré le{" "}
          {new Intl.DateTimeFormat("fr-FR", {
            dateStyle: "long",
            timeStyle: "short",
          }).format(new Date())}{" "}
          — {filteredData.length} adhérent(s)
        </p>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-2">Civilité</th>
              <th className="text-left py-2 px-2">Nom complet</th>
              <th className="text-left py-2 px-2">Connexions</th>
              <th className="text-left py-2 px-2">Dernière connexion</th>
              <th className="text-left py-2 px-2">Badge</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((r) => (
              <tr key={r.userId} className="border-b">
                <td className="py-1.5 px-2">{r.civility ?? "—"}</td>
                <td className="py-1.5 px-2">
                  {r.firstname} {r.lastname}
                </td>
                <td className="py-1.5 px-2">{r.loginCount}</td>
                <td className="py-1.5 px-2">
                  {r.lastLogin
                    ? new Intl.DateTimeFormat("fr-FR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(r.lastLogin))
                    : "Jamais"}
                </td>
                <td className="py-1.5 px-2">{r.badgeNom ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:to-slate-800 no-print">
        <div className="max-w-[100rem] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card className="mx-auto max-w-[100rem] shadow-xl border-blue-200 dark:border-blue-800">
            <CardHeader className="bg-gradient-to-r from-blue-500/90 to-blue-600/90 dark:from-blue-600/90 dark:to-blue-700/90 text-white rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <CardTitle className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                    <LogIn className="h-5 w-5" />
                    Connexions adhérents ({filteredData.length})
                  </CardTitle>
                  <p className="text-blue-100 text-xs sm:text-sm mt-1 max-w-2xl">
                    Encouragez l&apos;usage du portail plutôt que WhatsApp — badges
                    attribués selon le nombre de connexions (hors administrateurs).
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ColumnVisibilityToggle table={table} storageKey={STORAGE_KEY} />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSyncBadges}
                    disabled={syncing || loading}
                    className={headerBtn}
                  >
                    {syncing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Award className="h-4 w-4 mr-2" />
                    )}
                    Sync badges
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleExportExcel()}
                    disabled={loading || filteredData.length === 0}
                    className={headerBtn}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Excel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.print()}
                    disabled={loading || filteredData.length === 0}
                    className={headerBtn}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimer
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadData}
                    disabled={loading}
                    className={headerBtn}
                  >
                    <RefreshCw
                      className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
                    />
                    Actualiser
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-4 sm:pt-6 pb-4 px-4 sm:px-6">
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Rechercher par nom, email, badge..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={badgeFilter} onValueChange={setBadgeFilter}>
                  <SelectTrigger className="w-full sm:w-52">
                    <SelectValue placeholder="Filtrer par badge" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les badges</SelectItem>
                    <SelectItem value="aucun">Sans badge</SelectItem>
                    {badgeOptions.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : (
                <>
                  <div className="mb-4 text-sm text-gray-600 dark:text-gray-300">
                    {filteredData.length} adhérent(s) affiché(s)
                  </div>
                  <DataTable
                    table={table}
                    emptyMessage="Aucun adhérent trouvé"
                    compact={true}
                    headerBold={true}
                    headerUppercase={false}
                  />

                  <div className="bg-white dark:bg-gray-800 mt-5 flex flex-col sm:flex-row items-center justify-between py-5 font-semibold rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 gap-4 px-4">
                    <div className="text-sm text-muted-foreground dark:text-gray-400">
                      {table.getFilteredRowModel().rows.length} ligne(s) au total
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-4 lg:gap-8">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Lignes par page
                        </p>
                        <Select
                          value={`${table.getState().pagination.pageSize}`}
                          onValueChange={(value) =>
                            table.setPageSize(Number(value))
                          }
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
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Page {table.getState().pagination.pageIndex + 1} sur{" "}
                        {table.getPageCount() || 1}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          className="hidden h-8 w-8 p-0 lg:flex"
                          onClick={() => table.setPageIndex(0)}
                          disabled={!table.getCanPreviousPage()}
                        >
                          <ChevronsLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() => table.previousPage()}
                          disabled={!table.getCanPreviousPage()}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() => table.nextPage()}
                          disabled={!table.getCanNextPage()}
                        >
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
    </>
  );
}
