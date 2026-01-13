"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Calendar, 
  Eye, 
  Edit, 
  Trash2, 
  CheckCircle2, 
  Search,
  Award,
  Users,
  X,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from "lucide-react";
import Link from "next/link";
import { 
  getAllElectionsForAdmin, 
  updateElectionStatus, 
  adminDeleteElection,
  getElectionWithDetails
} from "@/actions/elections";
import { ElectionStatus } from "@prisma/client";
import { toast } from "sonner";
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
  getFilteredRowModel,
  getPaginationRowModel,
  VisibilityState,
} from "@tanstack/react-table";
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

type ElectionData = {
  id: string;
  titre: string;
  description?: string;
  status: ElectionStatus;
  dateOuverture: string;
  dateCloture: string;
  dateClotureCandidature?: string | null;
  dateScrutin: string;
  nombreMandats: number;
  quorumRequis: number;
  majoriteRequis: string;
  _count: {
    votes: number;
    positions?: number;
    candidacies?: number;
  };
};

type PositionData = {
  id: string;
  titre: string;
  type: string;
  candidacies: Array<{
    id: string;
    adherent: {
      User?: {
        name?: string;
        email?: string;
      };
    };
  }>;
};

const columnHelper = createColumnHelper<ElectionData>();

export default function AdminElectionsPage() {
  const [elections, setElections] = useState<ElectionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedElectionId, setSelectedElectionId] = useState<string | null>(null);
  const [selectedElectionDetails, setSelectedElectionDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Filtres
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sorting, setSorting] = useState<SortingState>([]);
  
  // Visibilité des colonnes - charger depuis localStorage ou utiliser les valeurs par défaut
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("admin-elections-column-visibility");
        if (saved) {
          return JSON.parse(saved);
        }
      } catch (error) {
        console.error("Erreur lors du chargement des préférences de colonnes:", error);
      }
    }
    return {};
  });

  // Charger les élections
  const loadElections = async () => {
    try {
      setLoading(true);
      const res = await getAllElectionsForAdmin();
      if (res.success && res.elections) {
        setElections(res.elections as ElectionData[]);
      }
    } catch (error) {
      console.error("Erreur lors du chargement:", error);
      toast.error("Erreur lors du chargement des élections");
    } finally {
      setLoading(false);
    }
  };

  // Charger les détails de l'élection sélectionnée
  const loadElectionDetails = async (electionId: string) => {
    try {
      setLoadingDetails(true);
      const res = await getElectionWithDetails(electionId);
      if (res.success && res.election) {
        setSelectedElectionDetails(res.election);
        setSidebarOpen(true);
      } else {
        toast.error(res.error || "Erreur lors du chargement");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement des détails");
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    loadElections();
  }, []);

  useEffect(() => {
    if (selectedElectionId) {
      loadElectionDetails(selectedElectionId);
    }
  }, [selectedElectionId]);

  // Filtrer les élections
  const filteredElections = useMemo(() => {
    return elections.filter(election => {
      const matchesSearch = searchTerm === "" || 
        election.titre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (election.description && election.description.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = statusFilter === "all" || election.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [elections, searchTerm, statusFilter]);

  // Actions
  const handleValidate = useCallback(async (electionId: string) => {
    const res = await updateElectionStatus(electionId, ElectionStatus.Ouverte);
    if (res.success) {
      toast.success("Élection validée (ouverte)");
      await loadElections();
      if (selectedElectionId === electionId) {
        await loadElectionDetails(electionId);
      }
    } else {
      toast.error(res.error || "Erreur lors de la validation");
    }
  }, [selectedElectionId]);

  const handleDelete = useCallback(async (electionId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette élection ? Cette action est irréversible.")) {
      return;
    }
    const res = await adminDeleteElection(electionId);
    if (res.success) {
      toast.success("Élection supprimée");
      await loadElections();
      if (selectedElectionId === electionId) {
        setSelectedElectionId(null);
        setSelectedElectionDetails(null);
        setSidebarOpen(false);
      }
    } else {
      toast.error(res.error || "Erreur lors de la suppression");
    }
  }, [selectedElectionId]);

  const handleSelectElection = useCallback((electionId: string) => {
    setSelectedElectionId(electionId);
  }, []);

  // Colonnes du tableau
  const columns = useMemo(() => [
    columnHelper.accessor("titre", {
      header: "Titre",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.titre}</span>
      ),
    }),
    columnHelper.accessor("status", {
      header: "Statut",
      cell: ({ row }) => {
        const status = row.original.status;
        const statusConfig = {
          [ElectionStatus.Preparation]: { label: "En préparation", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700" },
          [ElectionStatus.Ouverte]: { label: "Ouverte", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" },
          [ElectionStatus.Cloturee]: { label: "Clôturée", color: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 border border-sky-200 dark:border-sky-800" },
          [ElectionStatus.Annulee]: { label: "Annulée", color: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border border-rose-200 dark:border-rose-800" },
        };
        const config = statusConfig[status as keyof typeof statusConfig] || statusConfig[ElectionStatus.Preparation];
        return <Badge className={config.color}>{config.label}</Badge>;
      },
    }),
    columnHelper.accessor("dateOuverture", {
      header: "Date ouverture",
      cell: ({ row }) => new Date(row.original.dateOuverture).toLocaleDateString("fr-FR"),
    }),
    columnHelper.accessor("dateClotureCandidature", {
      header: "Clôture candidatures",
      cell: ({ row }) => {
        const date = row.original.dateClotureCandidature;
        if (!date) return <span className="text-gray-400 italic">Non définie</span>;
        return new Date(date).toLocaleDateString("fr-FR", {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      },
    }),
    columnHelper.accessor("dateCloture", {
      header: "Date clôture",
      cell: ({ row }) => new Date(row.original.dateCloture).toLocaleDateString("fr-FR"),
    }),
    columnHelper.accessor("dateScrutin", {
      header: "Date scrutin",
      cell: ({ row }) => new Date(row.original.dateScrutin).toLocaleDateString("fr-FR"),
    }),
    columnHelper.accessor("nombreMandats", {
      header: "Mandats",
      cell: ({ row }) => row.original.nombreMandats,
    }),
    columnHelper.accessor("quorumRequis", {
      header: "Quorum",
      cell: ({ row }) => `${row.original.quorumRequis}%`,
    }),
    columnHelper.accessor("_count.votes", {
      header: "Votes",
      cell: ({ row }) => row.original._count.votes,
    }),
    columnHelper.display({
      id: "actions",
      header: () => <div className="text-center w-full">Actions</div>,
      meta: { forceVisible: true },
      enableResizing: false,
      cell: ({ row }) => {
        const election = row.original;
        const isSelected = selectedElectionId === election.id;
        
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
                <DropdownMenuItem 
                  onClick={() => handleSelectElection(election.id)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Eye className="h-4 w-4" />
                  <span>{isSelected ? "Détails (sélectionné)" : "Voir les détails"}</span>
                  {isSelected && <span className="ml-auto text-xs text-green-600">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link 
                    href={`/admin/elections/${election.id}/consultation`}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Eye className="h-4 w-4" />
                    <span>Page de consultation</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link 
                    href={`/admin/elections/${election.id}/edition`}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Edit className="h-4 w-4" />
                    <span>Éditer</span>
                  </Link>
                </DropdownMenuItem>
                {election.status !== ElectionStatus.Ouverte && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => handleValidate(election.id)}
                      className="flex items-center gap-2 cursor-pointer text-green-600 dark:text-green-400 focus:text-green-600 dark:focus:text-green-400"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Valider (Ouvrir)</span>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => handleDelete(election.id)}
                  className="flex items-center gap-2 cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Supprimer</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
      size: 80,
      minSize: 70,
      maxSize: 100,
    }),
  ], [selectedElectionId, handleSelectElection, handleValidate, handleDelete]);

  const table = useReactTable({
    data: filteredElections,
    columns,
    state: { 
      sorting,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: (updater) => {
      const newVisibility = typeof updater === "function" ? updater(columnVisibility) : updater;
      setColumnVisibility(newVisibility);
      // Sauvegarder dans localStorage
      try {
        localStorage.setItem("admin-elections-column-visibility", JSON.stringify(newVisibility));
      } catch (error) {
        console.error("Erreur lors de la sauvegarde des préférences:", error);
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  // Récupérer les postes et candidats de l'élection sélectionnée
  const positions: PositionData[] = selectedElectionDetails?.positions || [];
  const allCandidacies = positions.flatMap(p => 
    (p.candidacies || []).map(c => ({
      ...c,
      positionTitre: p.titre
    }))
  );

  return (
    <div className="flex gap-6 relative">
      {/* Contenu principal */}
      <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'lg:mr-80' : ''}`}>
        <Card className="!py-0 border-2 border-teal-200 dark:border-teal-800/50 bg-white dark:bg-gray-900">
          <CardHeader className="pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 bg-gradient-to-r from-teal-100 to-teal-50 dark:from-teal-900/30 dark:to-teal-800/20 rounded-t-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl text-gray-700 dark:text-gray-200">
                <Calendar className="h-5 w-5 text-teal-500 dark:text-teal-400" />
                Gestion des Élections
              </CardTitle>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <ColumnVisibilityToggle 
                  table={table} 
                  storageKey="admin-elections-column-visibility"
                />
                <Link href="/admin/elections/gestion" className="w-full sm:w-auto">
                  <Button className="w-full sm:w-auto">
                    <Calendar className="h-4 w-4 mr-2" />
                    Créer une élection
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
                  placeholder="Rechercher par titre ou description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-11"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value={ElectionStatus.Preparation}>En préparation</SelectItem>
                  <SelectItem value={ElectionStatus.Ouverte}>Ouverte</SelectItem>
                  <SelectItem value={ElectionStatus.Cloturee}>Clôturée</SelectItem>
                  <SelectItem value={ElectionStatus.Annulee}>Annulée</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tableau */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                <div className="mb-4 text-sm text-gray-600 dark:text-gray-300">
                  {filteredElections.length} élection(s) trouvée(s)
                </div>
                <DataTable table={table} emptyMessage="Aucune élection trouvée" compact={true} />
                
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

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => {
            setSidebarOpen(false);
            setSelectedElectionId(null);
            setSelectedElectionDetails(null);
          }}
        />
      )}

      {/* Sidebar latérale */}
      {sidebarOpen && selectedElectionDetails && (
        <>
          {/* Desktop sidebar */}
          <div className="hidden lg:flex fixed right-6 top-24 bottom-6 w-80 bg-white dark:bg-gray-800 shadow-lg rounded-lg border border-gray-200 dark:border-gray-700 flex-col z-40">
            {/* Header sidebar */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-lg">Détails de l'élection</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSidebarOpen(false);
                  setSelectedElectionId(null);
                  setSelectedElectionDetails(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Contenu scrollable */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {loadingDetails ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <>
                  {/* Informations générales */}
                  <div>
                    <h4 className="font-semibold mb-2">{selectedElectionDetails.titre}</h4>
                    {selectedElectionDetails.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {selectedElectionDetails.description}
                      </p>
                    )}
                    <Badge className={
                      selectedElectionDetails.status === ElectionStatus.Ouverte 
                        ? "bg-green-100 text-green-800" 
                        : selectedElectionDetails.status === ElectionStatus.Cloturee
                        ? "bg-blue-100 text-blue-800"
                        : selectedElectionDetails.status === ElectionStatus.Annulee
                        ? "bg-red-100 text-red-800"
                        : "bg-gray-100 text-gray-800"
                    }>
                      {selectedElectionDetails.status}
                    </Badge>
                  </div>

                  {/* Statistiques */}
                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="font-medium">Postes:</span> {selectedElectionDetails._count?.positions || 0}
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Candidats:</span> {selectedElectionDetails._count?.candidacies || 0}
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Votes:</span> {selectedElectionDetails._count?.votes || 0}
                    </div>
                  </div>

                  {/* Liste des postes */}
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Award className="h-4 w-4" />
                      Postes associés ({positions.length})
                    </h4>
                    {positions.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">Aucun poste associé</p>
                    ) : (
                      <div className="space-y-2">
                        {positions.map((position) => (
                          <div key={position.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div className="font-medium text-sm">{position.titre}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {position.candidacies?.length || 0} candidat(s)
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Liste des candidats */}
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Candidats ({allCandidacies.length})
                    </h4>
                    {allCandidacies.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">Aucun candidat</p>
                    ) : (
                      <div className="space-y-2">
                        {allCandidacies.map((candidacy) => (
                          <div key={candidacy.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div className="font-medium text-sm">
                              {candidacy.adherent?.User?.name || candidacy.adherent?.User?.email || "Nom inconnu"}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Poste: {(candidacy as any).positionTitre || "N/A"}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Mobile sidebar (drawer) */}
          <div className="lg:hidden fixed right-0 top-0 bottom-0 w-full max-w-sm bg-white dark:bg-gray-800 shadow-lg z-50 flex flex-col transform transition-transform">
            {/* Header sidebar mobile */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-lg">Détails de l'élection</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSidebarOpen(false);
                  setSelectedElectionId(null);
                  setSelectedElectionDetails(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Contenu scrollable mobile */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {loadingDetails ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <>
                  {/* Informations générales */}
                  <div>
                    <h4 className="font-semibold mb-2">{selectedElectionDetails.titre}</h4>
                    {selectedElectionDetails.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {selectedElectionDetails.description}
                      </p>
                    )}
                    <Badge className={
                      selectedElectionDetails.status === ElectionStatus.Ouverte 
                        ? "bg-green-100 text-green-800" 
                        : selectedElectionDetails.status === ElectionStatus.Cloturee
                        ? "bg-blue-100 text-blue-800"
                        : selectedElectionDetails.status === ElectionStatus.Annulee
                        ? "bg-red-100 text-red-800"
                        : "bg-gray-100 text-gray-800"
                    }>
                      {selectedElectionDetails.status}
                    </Badge>
                  </div>

                  {/* Statistiques */}
                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="font-medium">Postes:</span> {selectedElectionDetails._count?.positions || 0}
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Candidats:</span> {selectedElectionDetails._count?.candidacies || 0}
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Votes:</span> {selectedElectionDetails._count?.votes || 0}
                    </div>
                  </div>

                  {/* Liste des postes */}
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Award className="h-4 w-4" />
                      Postes associés ({positions.length})
                    </h4>
                    {positions.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">Aucun poste associé</p>
                    ) : (
                      <div className="space-y-2">
                        {positions.map((position) => (
                          <div key={position.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div className="font-medium text-sm">{position.titre}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {position.candidacies?.length || 0} candidat(s)
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Liste des candidats */}
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Candidats ({allCandidacies.length})
                    </h4>
                    {allCandidacies.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">Aucun candidat</p>
                    ) : (
                      <div className="space-y-2">
                        {allCandidacies.map((candidacy) => (
                          <div key={candidacy.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div className="font-medium text-sm">
                              {candidacy.adherent?.User?.name || candidacy.adherent?.User?.email || "Nom inconnu"}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Poste: {(candidacy as any).positionTitre || "N/A"}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

    </div>
  );
}
