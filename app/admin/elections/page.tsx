"use client";

import { useEffect, useState, useMemo } from "react";
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
  X
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
} from "@tanstack/react-table";
import { DataTable } from "@/components/admin/DataTable";

type ElectionData = {
  id: string;
  titre: string;
  description?: string;
  status: ElectionStatus;
  dateOuverture: string;
  dateCloture: string;
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
  const handleValidate = async (electionId: string) => {
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
  };

  const handleDelete = async (electionId: string) => {
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
  };

  const handleSelectElection = (electionId: string) => {
    setSelectedElectionId(electionId);
  };

  // Colonnes du tableau
  const columns = useMemo(() => [
    columnHelper.display({
      id: "select",
      header: "",
      cell: ({ row }) => (
        <Button
          size="sm"
          variant={selectedElectionId === row.original.id ? "default" : "outline"}
          onClick={() => handleSelectElection(row.original.id)}
        >
          {selectedElectionId === row.original.id ? "Sélectionné" : "Sélectionner"}
        </Button>
      ),
    }),
    columnHelper.accessor("titre", {
      header: "Titre",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.titre}</span>
          {row.original.description && (
            <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
              {row.original.description}
            </span>
          )}
        </div>
      ),
    }),
    columnHelper.accessor("status", {
      header: "Statut",
      cell: ({ row }) => {
        const status = row.original.status;
        const statusConfig = {
          [ElectionStatus.Preparation]: { label: "En préparation", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200" },
          [ElectionStatus.Ouverte]: { label: "Ouverte", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
          [ElectionStatus.Cloturee]: { label: "Clôturée", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
          [ElectionStatus.Annulee]: { label: "Annulée", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
        };
        const config = statusConfig[status as keyof typeof statusConfig] || statusConfig[ElectionStatus.Preparation];
        return <Badge className={config.color}>{config.label}</Badge>;
      },
    }),
    columnHelper.accessor("dateOuverture", {
      header: "Date ouverture",
      cell: ({ row }) => new Date(row.original.dateOuverture).toLocaleDateString("fr-FR"),
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
      header: "Actions",
      cell: ({ row }) => {
        const election = row.original;
        return (
          <div className="flex items-center space-x-2">
            <Link href={`/admin/elections/${election.id}/consultation`}>
              <Button size="sm" variant="outline" title="Consultation">
                <Eye className="h-4 w-4" />
              </Button>
            </Link>
            <Link href={`/admin/elections/${election.id}/edition`}>
              <Button size="sm" variant="outline" title="Édition">
                <Edit className="h-4 w-4" />
              </Button>
            </Link>
            {election.status !== ElectionStatus.Ouverte && (
              <Button 
                size="sm" 
                variant="outline" 
                className="text-green-600 border-green-600 hover:bg-green-50" 
                onClick={() => handleValidate(election.id)}
                title="Valider (Ouvrir)"
              >
                <CheckCircle2 className="h-4 w-4" />
              </Button>
            )}
            <Button 
              size="sm" 
              variant="outline" 
              className="text-red-600 border-red-600 hover:bg-red-50" 
              onClick={() => handleDelete(election.id)}
              title="Supprimer"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    }),
  ], [selectedElectionId]);

  const table = useReactTable({
    data: filteredElections,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
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
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Gestion des Élections
              </CardTitle>
              <Link href="/admin/elections/gestion">
                <Button>
                  <Calendar className="h-4 w-4 mr-2" />
                  Créer une élection
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filtres */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher par titre ou description..."
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
                <DataTable table={table} emptyMessage="Aucune élection trouvée" />
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
