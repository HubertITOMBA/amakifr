"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  Calendar, 
  Vote,
  Award,
  CheckCircle,
  XCircle,
  Clock,
  Plus,
  Edit,
  Trash2,
  Power,
  Eye,
  Search,
  Filter
} from "lucide-react";
import { useState, useEffect } from "react";
import { 
  getAllCandidaciesForAdmin, 
  getAllElectionsForAdmin, 
  updateCandidacyStatus, 
  closeElection 
} from "@/actions/elections";
import { getAllPostesTemplates } from "@/actions/postes";
import { CandidacyStatus, ElectionStatus } from "@prisma/client";
import { POSTES_LABELS } from "@/lib/elections-constants";
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
  getFilteredRowModel,
  ColumnFiltersState,
} from "@tanstack/react-table";
import { DataTable } from "@/components/admin/DataTable";
import { VoteStats } from "@/components/admin/VoteStats";
import { CandidacyActions } from "@/components/admin/CandidacyActions";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";

// Types pour les tables
type CandidacyData = {
  id: string;
  adherent: {
    firstname: string;
    lastname: string;
    civility: string;
    User: {
      email: string;
    };
  };
  position: {
    id: string;
    titre: string;
    election: {
      id: string;
      titre: string;
    };
  };
  status: CandidacyStatus;
  motivation?: string;
  programme?: string;
  createdAt: string;
};

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
  majoriteRequise: string;
  positions: {
    id: string;
    titre: string;
    nombreMandats: number;
  }[];
  candidacies: {
    id: string;
    status: CandidacyStatus;
    adherent: {
      firstname: string;
      lastname: string;
    };
  }[];
  _count: {
    votes: number;
  };
};

type PosteTemplate = {
  id: string;
  code: string;
  libelle: string;
  description?: string;
  ordre: number;
  actif: boolean;
  nombreMandatsDefaut: number;
  dureeMandatDefaut?: number;
  createdAt: string;
  _count: {
    positions: number;
  };
};

// Helper pour les colonnes des tables
const columnHelper = createColumnHelper<CandidacyData>();
const electionColumnHelper = createColumnHelper<ElectionData>();
const posteColumnHelper = createColumnHelper<PosteTemplate>();

export default function AdminElectionsPage() {
  const [candidacies, setCandidacies] = useState<CandidacyData[]>([]);
  const [elections, setElections] = useState<ElectionData[]>([]);
  const [postes, setPostes] = useState<PosteTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [electionFilter, setElectionFilter] = useState<string>("all");
  
  // Filtres pour les élections
  const [electionGlobalFilter, setElectionGlobalFilter] = useState("");
  const [electionStatusFilter, setElectionStatusFilter] = useState<string>("all");
  
  // Filtres pour les postes
  const [posteGlobalFilter, setPosteGlobalFilter] = useState("");
  const [posteStatusFilter, setPosteStatusFilter] = useState<string>("all");
  
  // Filtres pour les votes
  const [voteStatusFilter, setVoteStatusFilter] = useState<string>("all");

  // Charger les données
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [candidaciesResult, electionsResult, postesResult] = await Promise.all([
        getAllCandidaciesForAdmin(),
        getAllElectionsForAdmin(),
        getAllPostesTemplates()
      ]);

      if (candidaciesResult.success && candidaciesResult.candidacies) {
        setCandidacies(candidaciesResult.candidacies as CandidacyData[]);
      }
      if (electionsResult.success && electionsResult.elections) {
        setElections(electionsResult.elections as ElectionData[]);
      }
      if (postesResult.success && postesResult.data) {
        setPostes(postesResult.data as unknown as PosteTemplate[]);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des données:", error);
    } finally {
      setLoading(false);
    }
  };

  // Gestion des candidatures
  const handleUpdateCandidacyStatus = async (candidacyId: string, status: CandidacyStatus) => {
    try {
      const result = await updateCandidacyStatus(candidacyId, status);
      if (result.success) {
        await loadData();
      }
    } catch (error) {
      console.error("Erreur lors de la mise à jour:", error);
    }
  };

  // Gestion des élections
  const handleCloseElection = async (electionId: string) => {
    try {
      const result = await closeElection(electionId);
      if (result.success) {
        await loadData();
      }
    } catch (error) {
      console.error("Erreur lors de la fermeture:", error);
    }
  };

  // Colonnes pour les candidatures
  const candidacyColumns = [
    columnHelper.accessor("adherent", {
      header: "Candidat",
      cell: ({ row }) => {
        const candidacy = row.original;
        return (
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  {candidacy.adherent.firstname[0]}{candidacy.adherent.lastname[0]}
                </span>
              </div>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-medium truncate">
                {candidacy.adherent.civility} {candidacy.adherent.firstname} {candidacy.adherent.lastname}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400 truncate">{candidacy.adherent.User.email}</span>
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor("position", {
      header: "Poste & Élection",
      cell: ({ row }) => {
        const candidacy = row.original;
        return (
          <div className="flex flex-col min-w-0">
            <span className="font-medium truncate">{candidacy.position.titre}</span>
            <span className="text-sm text-gray-500 dark:text-gray-400 truncate">{candidacy.position.election.titre}</span>
          </div>
        );
      },
    }),
    columnHelper.accessor("status", {
      header: "Statut",
      cell: ({ row }) => {
        const status = row.original.status;
        const statusConfig = {
          [CandidacyStatus.EnAttente]: { 
            label: "En attente", 
            color: "bg-yellow-100 text-yellow-800 border-yellow-200",
            icon: Clock
          },
          [CandidacyStatus.Validee]: { 
            label: "Approuvée", 
            color: "bg-green-100 text-green-800 border-green-200",
            icon: CheckCircle
          },
          [CandidacyStatus.Rejetee]: { 
            label: "Rejetée", 
            color: "bg-red-100 text-red-800 border-red-200",
            icon: XCircle
          },
        };
        const config = statusConfig[status as keyof typeof statusConfig];
        const Icon = config?.icon || Clock;
        return (
          <Badge className={`${config.color} flex items-center gap-1 w-fit`}>
            <Icon className="h-3 w-3" />
            {config.label}
          </Badge>
        );
      },
    }),
    columnHelper.accessor("createdAt", {
      header: "Date candidature",
      cell: ({ row }) => {
        const date = new Date(row.original.createdAt);
        return (
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              {date.toLocaleDateString("fr-FR")}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {date.toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        );
      },
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const candidacy = row.original;
        return (
          <div className="flex items-center space-x-1">
            <Button
              size="sm"
              variant="outline"
              asChild
              className="h-8 w-8 p-0"
            >
              <Link href={`/admin/candidatures/${candidacy.id}`}>
                <Eye className="h-4 w-4" />
              </Link>
            </Button>
            {candidacy.status === CandidacyStatus.EnAttente && (
              <CandidacyActions
                candidacyId={candidacy.id}
                candidacyName={`${candidacy.adherent.civility} ${candidacy.adherent.firstname} ${candidacy.adherent.lastname}`}
                position={candidacy.position.titre}
                onStatusUpdate={handleUpdateCandidacyStatus}
              />
            )}
          </div>
        );
      },
    }),
  ];

  // Colonnes pour les élections
  const electionColumns = [
    electionColumnHelper.accessor("titre", {
      header: "Titre",
      cell: ({ row }) => {
        const election = row.original;
        return (
          <div className="flex flex-col">
            <span className="font-medium">{election.titre}</span>
            {election.description && (
              <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                {election.description}
              </span>
            )}
          </div>
        );
      },
    }),
    electionColumnHelper.accessor("status", {
      header: "Statut",
      cell: ({ row }) => {
        const status = row.original.status;
        const statusConfig = {
          [ElectionStatus.Preparation]: { label: "En préparation", color: "bg-gray-100 text-gray-800" },
          [ElectionStatus.Ouverte]: { label: "Ouverte", color: "bg-green-100 text-green-800" },
          [ElectionStatus.Cloturee]: { label: "Clôturée", color: "bg-blue-100 text-blue-800" },
          [ElectionStatus.Annulee]: { label: "Annulée", color: "bg-red-100 text-red-800" },
        };
        const config = statusConfig[status as keyof typeof statusConfig];
        return <Badge className={config.color}>{config.label}</Badge>;
      },
    }),
    electionColumnHelper.accessor("positions", {
      header: "Postes",
      cell: ({ row }) => {
        const election = row.original;
        return (
          <div className="flex flex-wrap gap-1">
            {election.positions.map((position) => (
              <Badge key={position.id} variant="outline" className="text-xs">
                {position.titre} ({position.nombreMandats})
              </Badge>
            ))}
          </div>
        );
      },
    }),
    electionColumnHelper.accessor("_count.votes", {
      header: "Votes",
      cell: ({ row }) => {
        return (
          <div className="text-center">
            <span className="font-medium">{row.original._count.votes}</span>
          </div>
        );
      },
    }),
    electionColumnHelper.accessor("dateScrutin", {
      header: "Date scrutin",
      cell: ({ row }) => {
        return new Date(row.original.dateScrutin).toLocaleDateString("fr-FR");
      },
    }),
    electionColumnHelper.display({
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const election = row.original;
        return (
          <div className="flex space-x-2">
            <Button size="sm" variant="outline" asChild>
              <Link href={`/admin/elections/${election.id}/consultation`}>
                <Eye className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href={`/admin/elections/${election.id}/edition`}>
                <Edit className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        );
      },
    }),
  ];

  // Colonnes pour les postes
  const posteColumns = [
    posteColumnHelper.accessor("libelle", {
      header: "Libellé",
      cell: ({ row }) => {
        const poste = row.original;
        return (
          <div className="flex flex-col">
            <span className="font-medium">{poste.libelle}</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">{poste.code}</span>
          </div>
        );
      },
    }),
    posteColumnHelper.accessor("description", {
      header: "Description",
      cell: ({ row }) => {
        const description = row.original.description;
        return (
          <span className="text-sm text-gray-600 dark:text-gray-300 truncate max-w-xs">
            {description || "Aucune description"}
          </span>
        );
      },
    }),
    posteColumnHelper.accessor("actif", {
      header: "Statut",
      cell: ({ row }) => {
        const actif = row.original.actif;
        return (
          <Badge className={actif ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
            {actif ? "Actif" : "Inactif"}
          </Badge>
        );
      },
    }),
    posteColumnHelper.accessor("_count.positions", {
      header: "Utilisations",
      cell: ({ row }) => {
        return (
          <div className="text-center">
            <span className="font-medium">{row.original._count.positions}</span>
          </div>
        );
      },
    }),
    posteColumnHelper.accessor("createdAt", {
      header: "Créé le",
      cell: ({ row }) => {
        return new Date(row.original.createdAt).toLocaleDateString("fr-FR");
      },
    }),
    posteColumnHelper.display({
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        return (
          <div className="flex space-x-2">
            <Button size="sm" variant="outline" asChild>
              <Link href={`/admin/postes`}>
                <Edit className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        );
      },
    }),
  ];

  // Filtrer les candidatures
  const filteredCandidacies = candidacies.filter(candidacy => {
    const matchesGlobal = globalFilter === "" || 
      candidacy.adherent.firstname.toLowerCase().includes(globalFilter.toLowerCase()) ||
      candidacy.adherent.lastname.toLowerCase().includes(globalFilter.toLowerCase()) ||
      candidacy.adherent.User.email.toLowerCase().includes(globalFilter.toLowerCase()) ||
      candidacy.position.titre.toLowerCase().includes(globalFilter.toLowerCase()) ||
      candidacy.position.election.titre.toLowerCase().includes(globalFilter.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || candidacy.status === statusFilter;
    const matchesElection = electionFilter === "all" || candidacy.position.election.id === electionFilter;
    
    return matchesGlobal && matchesStatus && matchesElection;
  });

  // Filtrer les élections
  const filteredElections = elections.filter(election => {
    const matchesGlobal = electionGlobalFilter === "" || 
      election.titre.toLowerCase().includes(electionGlobalFilter.toLowerCase()) ||
      (election.description && election.description.toLowerCase().includes(electionGlobalFilter.toLowerCase()));
    
    const matchesStatus = electionStatusFilter === "all" || election.status === electionStatusFilter;
    
    return matchesGlobal && matchesStatus;
  });

  // Filtrer les postes
  const filteredPostes = postes.filter(poste => {
    const matchesGlobal = posteGlobalFilter === "" || 
      poste.libelle.toLowerCase().includes(posteGlobalFilter.toLowerCase()) ||
      poste.code.toLowerCase().includes(posteGlobalFilter.toLowerCase()) ||
      (poste.description && poste.description.toLowerCase().includes(posteGlobalFilter.toLowerCase()));
    
    const matchesStatus = posteStatusFilter === "all" || 
      (posteStatusFilter === "actif" && poste.actif) ||
      (posteStatusFilter === "inactif" && !poste.actif);
    
    return matchesGlobal && matchesStatus;
  });

  // Filtrer les élections pour les votes
  const filteredVoteElections = elections.filter(election => {
    const matchesStatus = voteStatusFilter === "all" || election.status === voteStatusFilter;
    return matchesStatus;
  });

  // Tables
  const candidacyTable = useReactTable({
    data: filteredCandidacies,
    columns: candidacyColumns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const electionTable = useReactTable({
    data: filteredElections,
    columns: electionColumns,
    state: { sorting, columnFilters, globalFilter: electionGlobalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setElectionGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const posteTable = useReactTable({
    data: filteredPostes,
    columns: posteColumns,
    state: { sorting, columnFilters, globalFilter: posteGlobalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setPosteGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Clock className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Chargement des données...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Gestion des Élections</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Gérez les postes électoraux, candidatures et élections
        </p>
      </div>

      <Tabs defaultValue="postes" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="postes" className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            Postes
          </TabsTrigger>
          <TabsTrigger value="candidats" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Candidats
          </TabsTrigger>
          <TabsTrigger value="elections" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Élections
          </TabsTrigger>
          <TabsTrigger value="votes" className="flex items-center gap-2">
            <Vote className="h-4 w-4" />
            Votes
          </TabsTrigger>
        </TabsList>

        {/* Onglet Postes */}
        <TabsContent value="postes" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Gestion des Postes Électoraux
              </CardTitle>
              <Button asChild>
                <Link href="/admin/postes">
                  <Plus className="h-4 w-4 mr-2" />
                  Gérer les postes
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Rechercher par libellé, code ou description..."
                    value={posteGlobalFilter}
                    onChange={(e) => setPosteGlobalFilter(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={posteStatusFilter} onValueChange={setPosteStatusFilter}>
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
              <div className="mb-4 flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
                <span>
                  {filteredPostes.length} poste(s) trouvé(s)
                  {posteGlobalFilter && ` pour "${posteGlobalFilter}"`}
                  {posteStatusFilter !== "all" && ` (${posteStatusFilter})`}
                </span>
                {(filteredPostes.length !== postes.length || posteGlobalFilter || posteStatusFilter !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPosteGlobalFilter("");
                      setPosteStatusFilter("all");
                    }}
                  >
                    Effacer les filtres
                  </Button>
                )}
              </div>
              <DataTable table={posteTable} emptyMessage="Aucun poste trouvé" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Candidats */}
        <TabsContent value="candidats" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Candidatures
              </CardTitle>
              <div className="flex flex-col sm:flex-row gap-4 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Rechercher par nom, email, poste ou élection..."
                    value={globalFilter}
                    onChange={(e) => setGlobalFilter(e.target.value)}
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
                    <SelectItem value={CandidacyStatus.Validee}>Approuvées</SelectItem>
                    <SelectItem value={CandidacyStatus.Rejetee}>Rejetées</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={electionFilter} onValueChange={setElectionFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filtrer par élection" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les élections</SelectItem>
                    {elections.map(election => (
                      <SelectItem key={election.id} value={election.id}>
                        {election.titre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
                <span>
                  {filteredCandidacies.length} candidature(s) trouvée(s)
                  {globalFilter && ` pour "${globalFilter}"`}
                  {statusFilter !== "all" && ` (${statusFilter})`}
                  {electionFilter !== "all" && ` (${elections.find(e => e.id === electionFilter)?.titre})`}
                </span>
                {(filteredCandidacies.length !== candidacies.length || globalFilter || statusFilter !== "all" || electionFilter !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setGlobalFilter("");
                      setStatusFilter("all");
                      setElectionFilter("all");
                    }}
                  >
                    Effacer les filtres
                  </Button>
                )}
              </div>
              <DataTable table={candidacyTable} emptyMessage="Aucune candidature trouvée" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Élections */}
        <TabsContent value="elections" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Élections
              </CardTitle>
              <Button asChild>
                <Link href="/admin/elections/gestion">
                  <Plus className="h-4 w-4 mr-2" />
                  Créer une élection
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Rechercher par titre ou description..."
                    value={electionGlobalFilter}
                    onChange={(e) => setElectionGlobalFilter(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={electionStatusFilter} onValueChange={setElectionStatusFilter}>
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
              <div className="mb-4 flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
                <span>
                  {filteredElections.length} élection(s) trouvée(s)
                  {electionGlobalFilter && ` pour "${electionGlobalFilter}"`}
                  {electionStatusFilter !== "all" && ` (${electionStatusFilter})`}
                </span>
                {(filteredElections.length !== elections.length || electionGlobalFilter || electionStatusFilter !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setElectionGlobalFilter("");
                      setElectionStatusFilter("all");
                    }}
                  >
                    Effacer les filtres
                  </Button>
                )}
              </div>
              <DataTable table={electionTable} emptyMessage="Aucune élection trouvée" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Votes */}
        <TabsContent value="votes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Vote className="h-5 w-5" />
                Votes et Résultats
              </CardTitle>
              <div className="flex flex-col sm:flex-row gap-4 mt-4">
                <Select value={voteStatusFilter} onValueChange={setVoteStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filtrer par statut d'élection" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les élections</SelectItem>
                    <SelectItem value={ElectionStatus.Preparation}>En préparation</SelectItem>
                    <SelectItem value={ElectionStatus.Ouverte}>Ouverte</SelectItem>
                    <SelectItem value={ElectionStatus.Cloturee}>Clôturée</SelectItem>
                    <SelectItem value={ElectionStatus.Annulee}>Annulée</SelectItem>
                  </SelectContent>
                </Select>
                {voteStatusFilter !== "all" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setVoteStatusFilter("all")}
                  >
                    Effacer le filtre
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <VoteStats elections={filteredVoteElections.map(e => ({
                ...e,
                status: e.status as string,
                positions: (e as any).positions?.map((p: any) => ({
                  ...p,
                  candidacies: p.candidacies || []
                })) || []
              }))} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
