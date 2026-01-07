"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, CheckCircle, XCircle, Plus, Eye, Edit, Search, Upload, Loader2, MoreHorizontal, Mail, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { CandidacyStatus } from "@prisma/client";
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
  getAllCandidaciesForAdmin, 
  updateCandidacyStatus,
  importStaticCandidates
} from "@/actions/elections";
import { POSTES_LABELS } from "@/lib/elections-constants";
import Link from "next/link";
import { toast } from "sonner";
import { DataTable } from "@/components/admin/DataTable";
import { ColumnVisibilityToggle } from "@/components/admin/ColumnVisibilityToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type CandidacyData = {
  id: string;
  adherent: {
    id?: string;
    firstname: string;
    lastname: string;
    civility: string;
    User: { email: string };
    Telephones: Array<{ numero: string; type: string }>;
  };
  electionId?: string;
  position: {
    id?: string;
    type: string;
    titre: string;
    election: { id?: string; titre: string; status: string; dateOuverture: string; dateCloture: string };
  };
  status: string;
  motivation: string;
  programme: string;
  createdAt: string;
};

const columnHelper = createColumnHelper<CandidacyData>();

const getStatusColor = (status: string) => {
  switch (status) {
    case CandidacyStatus.Validee:
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case CandidacyStatus.Rejetee:
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    case CandidacyStatus.EnAttente:
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case CandidacyStatus.Validee:
      return "Validée";
    case CandidacyStatus.Rejetee:
      return "Rejetée";
    case CandidacyStatus.EnAttente:
      return "En attente";
    default:
      return status;
  }
};

export default function AdminCandidaturesPage() {
  const [candidacies, setCandidacies] = useState<CandidacyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [electionFilter, setElectionFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [importing, setImporting] = useState(false);
  
  // Visibilité des colonnes - charger depuis localStorage
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("admin-candidatures-column-visibility");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Object.keys(parsed).length > 0) {
            return parsed;
          }
        }
        // Par défaut sur mobile, masquer les colonnes non essentielles
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
          return {
            civility: false,
            position: false,
            election: false,
            dateCandidature: false,
            // Garder visible : adherent, statut, actions
          };
        }
      } catch (error) {
        console.error("Erreur lors du chargement des préférences de colonnes:", error);
      }
    }
    return {};
  });

  // Détecter les changements de taille d'écran
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      const saved = localStorage.getItem("admin-candidatures-column-visibility");
      
      if (isMobile && (!saved || Object.keys(JSON.parse(saved || "{}")).length === 0)) {
        setColumnVisibility({
          position: false,
          election: false,
          dateCandidature: false,
        });
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Debounce pour la recherche
  useEffect(() => {
    const timer = setTimeout(() => {
      setGlobalFilter(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadAll = async () => {
    const res = await getAllCandidaciesForAdmin();
    if (res.success) setCandidacies(res.candidacies as any);
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

  const handleCandidacyStatusChange = async (candidacyId: string, status: CandidacyStatus) => {
    const result = await updateCandidacyStatus(candidacyId, status);
    if (result.success) {
      setCandidacies(prev => prev.map(c => (c.id === candidacyId ? { ...c, status } as any : c)));
      toast.success(`Candidature ${status === CandidacyStatus.Validee ? 'validée' : 'rejetée'}. Un email a été envoyé au candidat.`);
      await loadAll();
    } else {
      toast.error(result.error || "Erreur lors de la mise à jour");
    }
  };

  const handleImportStaticCandidates = async () => {
    if (!confirm("Voulez-vous importer les candidats statiques de la page /candidats dans la base de données pour l'élection du 29/11/2025 ?")) {
      return;
    }

    try {
      setImporting(true);
      const result = await importStaticCandidates();
      
      if (result.success) {
        toast.success(result.message || "Import réussi");
        if (result.details) {
          const created = result.details.filter(d => d.status === 'created').length;
          const exists = result.details.filter(d => d.status === 'exists').length;
          const notFound = result.details.filter(d => d.status === 'not_found').length;
          const errors = result.details.filter(d => d.status === 'error').length;
          
          if (notFound > 0 || errors > 0) {
            console.warn("Détails de l'import:", result.details);
            toast.warning(`${created} créée(s), ${exists} existante(s), ${notFound} non trouvé(s), ${errors} erreur(s)`);
          }
        }
        await loadAll();
      } else {
        toast.error(result.error || "Erreur lors de l'import");
      }
    } catch (error: any) {
      console.error("Erreur lors de l'import:", error);
      toast.error(error.message || "Erreur lors de l'import");
    } finally {
      setImporting(false);
    }
  };

  // Liste unique des élections pour le filtre
  const uniqueElections = useMemo(() => {
    const elections = new Map<string, string>();
    candidacies.forEach(c => {
      if (c.position.election.id && c.position.election.titre) {
        elections.set(c.position.election.id, c.position.election.titre);
      }
    });
    return Array.from(elections.entries()).map(([id, titre]) => ({ id, titre }));
  }, [candidacies]);

  // Filtrer les candidatures
  const filteredCandidacies = useMemo(() => {
    return candidacies.filter(candidacy => {
      const matchesGlobal = globalFilter === "" || 
        candidacy.adherent.firstname.toLowerCase().includes(globalFilter.toLowerCase()) ||
        candidacy.adherent.lastname.toLowerCase().includes(globalFilter.toLowerCase()) ||
        candidacy.position.titre.toLowerCase().includes(globalFilter.toLowerCase()) ||
        candidacy.position.election.titre.toLowerCase().includes(globalFilter.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || candidacy.status === statusFilter;
      const matchesElection = electionFilter === "all" || candidacy.position.election.id === electionFilter;
      
      return matchesGlobal && matchesStatus && matchesElection;
    });
  }, [candidacies, globalFilter, statusFilter, electionFilter]);

  const columns = useMemo(() => [
    columnHelper.accessor("adherent.civility", {
      id: "civility",
      header: "Civilité",
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="font-medium text-gray-900 dark:text-gray-100 text-xs sm:text-sm">
            {c.adherent.civility || "—"}
          </div>
        );
      },
    }),
    columnHelper.accessor("adherent.firstname", {
      id: "name",
      header: "Nom complet",
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="font-medium text-gray-900 dark:text-gray-100 text-xs sm:text-sm">
            {c.adherent.firstname} {c.adherent.lastname}
          </div>
        );
      },
    }),
    columnHelper.accessor("position.election.titre", {
      header: "Élection",
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="font-medium text-gray-900 dark:text-gray-100">
            {c.position.election.titre}
          </div>
        );
      },
    }),
    columnHelper.accessor("position.type", {
      header: "Poste",
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="font-medium text-gray-900 dark:text-gray-100">
            {POSTES_LABELS[c.position.type as keyof typeof POSTES_LABELS] || c.position.titre}
          </div>
        );
      },
    }),
    columnHelper.accessor("status", {
      header: "Statut",
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return <Badge className={`${getStatusColor(status)} text-xs font-semibold`}>{getStatusLabel(status)}</Badge>;
      },
    }),
    columnHelper.accessor("createdAt", {
      header: "Date",
      cell: ({ row }) => {
        const d = new Date(row.getValue("createdAt"));
        return <span className="text-sm text-gray-600 dark:text-gray-300">{d.toLocaleDateString()}</span>;
      },
    }),
    columnHelper.display({
      id: "actions",
      header: () => <div className="text-center w-full">Actions</div>,
      meta: { forceVisible: true },
      enableResizing: false,
      cell: ({ row }) => {
        const c = row.original as any;
        const canValidateOrReject = c.status === CandidacyStatus.EnAttente;
        const userEmail = c.adherent?.User?.email;
        
        return (
          <div className="flex items-center justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Ouvrir le menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link 
                    href={`/admin/candidatures/${c.id}/consultation`}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Eye className="h-4 w-4" />
                    <span>Voir les détails</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link 
                    href={`/admin/candidatures/${c.id}/edition`}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Edit className="h-4 w-4" />
                    <span>Éditer</span>
                  </Link>
                </DropdownMenuItem>
                {canValidateOrReject && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => handleCandidacyStatusChange(c.id, CandidacyStatus.Validee)}
                      className="flex items-center gap-2 cursor-pointer text-emerald-600 dark:text-emerald-400 focus:text-emerald-600 dark:focus:text-emerald-400"
                    >
                      <CheckCircle className="h-4 w-4" />
                      <span>Valider</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleCandidacyStatusChange(c.id, CandidacyStatus.Rejetee)}
                      className="flex items-center gap-2 cursor-pointer text-rose-600 dark:text-rose-400 focus:text-rose-600 dark:focus:text-rose-400"
                    >
                      <XCircle className="h-4 w-4" />
                      <span>Rejeter</span>
                    </DropdownMenuItem>
                  </>
                )}
                {userEmail && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => {
                        // TODO: Implémenter l'envoi d'email au candidat
                        toast.info("Fonctionnalité d'envoi d'email à venir");
                      }}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Mail className="h-4 w-4" />
                      <span>Envoyer un email</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
      size: 80,
      minSize: 70,
      maxSize: 100,
    }),
  ], [handleCandidacyStatusChange]);

  const table = useReactTable({
    data: filteredCandidacies,
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
        localStorage.setItem("admin-candidatures-column-visibility", JSON.stringify(newVisibility));
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
  });

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <Card className="!py-0 border-2 border-indigo-200 dark:border-indigo-800/50 bg-white dark:bg-gray-900">
        <CardHeader className="pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 bg-gradient-to-r from-indigo-100 to-indigo-50 dark:from-indigo-900/30 dark:to-indigo-800/20 rounded-t-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <CardTitle className="flex items-center text-lg sm:text-xl text-gray-700 dark:text-gray-200">
              <Users className="h-5 w-5 mr-2 text-indigo-500 dark:text-indigo-400" />
              Candidatures
            </CardTitle>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <ColumnVisibilityToggle 
                table={table} 
                storageKey="admin-candidatures-column-visibility"
              />
              <Button 
                onClick={handleImportStaticCandidates}
                disabled={importing}
                variant="outline"
                className="w-full sm:w-auto border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30"
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Import en cours...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Importer candidats statiques
                  </>
                )}
              </Button>
              <Link href="/admin/candidatures/gestion" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle candidature
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 sm:pt-6 pb-4 px-4 sm:px-6">
          {/* Filtres */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher par nom, poste ou élection..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value={CandidacyStatus.EnAttente}>En attente</SelectItem>
                <SelectItem value={CandidacyStatus.Validee}>Validées</SelectItem>
                <SelectItem value={CandidacyStatus.Rejetee}>Rejetées</SelectItem>
              </SelectContent>
            </Select>
            <Select value={electionFilter} onValueChange={setElectionFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrer par élection" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les élections</SelectItem>
                {uniqueElections.map(election => (
                  <SelectItem key={election.id} value={election.id}>
                    {election.titre}
                  </SelectItem>
                ))}
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
                {filteredCandidacies.length} candidature(s) trouvée(s)
              </div>
              <DataTable table={table} emptyMessage="Aucune candidature trouvée" compact={true} />
              
              {/* Pagination */}
              <div className="bg-white dark:bg-gray-800 mt-5 flex flex-col sm:flex-row items-center justify-between py-5 font-semibold rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 gap-4 sm:gap-0">
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

                  <div className="flex items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
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
  );
}
