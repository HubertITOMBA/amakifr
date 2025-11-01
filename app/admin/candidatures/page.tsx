"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, CheckCircle, XCircle, Plus, Eye, Edit, Search } from "lucide-react";
import { CandidacyStatus } from "@prisma/client";
import { 
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
  getFilteredRowModel,
  ColumnFiltersState,
} from "@tanstack/react-table";
import { 
  getAllCandidaciesForAdmin, 
  updateCandidacyStatus
} from "@/actions/elections";
import { POSTES_LABELS } from "@/lib/elections-constants";
import Link from "next/link";
import { toast } from "sonner";
import { DataTable } from "@/components/admin/DataTable";

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
                <Button size="sm" variant="outline" className="text-green-600 border-green-600 hover:bg-green-50" onClick={() => handleCandidacyStatusChange(c.id, CandidacyStatus.Validee)} title="Valider">
                  <CheckCircle className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" className="text-red-600 border-red-600 hover:bg-red-50" onClick={() => handleCandidacyStatusChange(c.id, CandidacyStatus.Rejetee)} title="Rejeter">
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
    state: { sorting, columnFilters, globalFilter },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Candidatures
          </CardTitle>
          <Link href="/admin/candidatures/gestion">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle candidature
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {/* Filtres */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
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
