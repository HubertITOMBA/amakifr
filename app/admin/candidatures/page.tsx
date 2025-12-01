"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, CheckCircle, XCircle, Plus, Eye, Edit, Search, Upload, Loader2 } from "lucide-react";
import { CandidacyStatus } from "@prisma/client";
import { 
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
  getFilteredRowModel,
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
          return JSON.parse(saved);
        }
      } catch (error) {
        console.error("Erreur lors du chargement des préférences de colonnes:", error);
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
    columnHelper.accessor("adherent.firstname", {
      header: "Candidat",
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="font-medium text-gray-900 dark:text-gray-100">
            {c.adherent.civility && (
              <span className="text-sm text-gray-500 mr-1">
                {c.adherent.civility === 'Monsieur' ? 'M.' : c.adherent.civility === 'Madame' ? 'Mme' : c.adherent.civility}
              </span>
            )}
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
      header: "Actions",
      meta: { forceVisible: true }, // Cette colonne ne peut pas être masquée
      cell: ({ row }) => {
        const c = row.original as any;
        return (
          <div className="flex items-center space-x-2">
            <Link href={`/admin/candidatures/${c.id}/consultation`}>
              <Button size="sm" variant="outline" title="Voir">
                <Eye className="h-4 w-4" />
              </Button>
            </Link>
            <Link href={`/admin/candidatures/${c.id}/edition`}>
              <Button size="sm" variant="outline" title="Éditer">
                <Edit className="h-4 w-4" />
              </Button>
            </Link>
            {c.status === CandidacyStatus.EnAttente && (
              <>
                <Button size="sm" variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20" onClick={() => handleCandidacyStatusChange(c.id, CandidacyStatus.Validee)} title="Valider">
                  <CheckCircle className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" className="text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20" onClick={() => handleCandidacyStatusChange(c.id, CandidacyStatus.Rejetee)} title="Rejeter">
                  <XCircle className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        );
      },
    }),
  ], []);

  const table = useReactTable({
    data: filteredCandidacies,
    columns,
    getCoreRowModel: getCoreRowModel(),
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
              <DataTable table={table} emptyMessage="Aucune candidature trouvée" />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
