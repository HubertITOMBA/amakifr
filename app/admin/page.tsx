"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
// Navigation par menu latéral (remplace les Tabs)
import { 
  Users, 
  Calendar, 
  Mail, 
  TrendingUp,
  UserPlus,
  MessageSquare,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Vote,
  Award,
  CheckCircle,
  XCircle,
  Clock
} from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  getAllCandidaciesForAdmin, 
  getAllElectionsForAdmin, 
  updateCandidacyStatus, 
  closeElection,
  getElectionsLightForAdmin
} from "@/actions/elections";
import { getAllPostesTemplates } from "@/actions/postes";
import { CandidacyStatus, ElectionStatus } from "@prisma/client";
import { POSTES_LABELS } from "@/lib/elections-constants";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
  getFilteredRowModel,
  ColumnFiltersState,
} from "@tanstack/react-table";

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
    Telephones: Array<{
      numero: string;
      type: string;
    }>;
  };
  position: {
    type: string;
    titre: string;
    election: {
      titre: string;
      status: string;
      dateOuverture: string;
      dateCloture: string;
    };
  };
  status: string;
  motivation: string;
  programme: string;
  createdAt: string;
};

type ElectionData = {
  id: string;
  titre: string;
  status: string;
  dateOuverture: string;
  dateCloture: string;
  positions: Array<{
    candidacies: Array<any>;
    votes: Array<any>;
  }>;
};

// Helper pour créer les colonnes
const columnHelper = createColumnHelper<CandidacyData>();

// Fonction pour obtenir la couleur du statut
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

// Données d'exemple pour le dashboard
const stats = [
  {
    title: "Total Membres",
    value: "124",
    change: "+12%",
    changeType: "positive" as const,
    icon: Users,
    description: "Membres actifs cette année"
  },
  {
    title: "Événements",
    value: "8",
    change: "+2",
    changeType: "positive" as const,
    icon: Calendar,
    description: "Événements ce mois"
  },
  {
    title: "Newsletter",
    value: "89",
    change: "+15%",
    changeType: "positive" as const,
    icon: Mail,
    description: "Abonnés à la newsletter"
  },
  {
    title: "Engagement",
    value: "94%",
    change: "+5%",
    changeType: "positive" as const,
    icon: TrendingUp,
    description: "Taux d'engagement moyen"
  }
];

const recentActivities = [
  {
    id: 1,
    type: "user",
    action: "Nouveau membre inscrit",
    user: "Jean Dupont",
    time: "Il y a 2 heures",
    status: "success"
  },
  {
    id: 2,
    type: "event",
    action: "Événement créé",
    user: "Marie Martin",
    time: "Il y a 4 heures",
    status: "info"
  },
  {
    id: 3,
    type: "newsletter",
    action: "Newsletter envoyée",
    user: "Système",
    time: "Il y a 1 jour",
    status: "success"
  },
  {
    id: 4,
    type: "user",
    action: "Profil mis à jour",
    user: "Pierre Durand",
    time: "Il y a 2 jours",
    status: "info"
  }
];

const upcomingEvents = [
  {
    id: 1,
    title: "Assemblée Générale",
    date: "2024-02-15",
    time: "14:00",
    attendees: 45,
    status: "confirmed"
  },
  {
    id: 2,
    title: "Formation Leadership",
    date: "2024-02-22",
    time: "09:00",
    attendees: 20,
    status: "confirmed"
  },
  {
    id: 3,
    title: "Soirée Networking",
    date: "2024-02-28",
    time: "19:00",
    attendees: 30,
    status: "pending"
  }
];

export default function AdminDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSection = (searchParams?.get("section") || "dashboard");
  const [candidacies, setCandidacies] = useState<CandidacyData[]>([]);
  const [elections, setElections] = useState<ElectionData[]>([]);
  const [postes, setPostes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [activeTab, setActiveTab] = useState<string>(initialSection);
  const [loadingElectionsTab, setLoadingElectionsTab] = useState(false);
  const [loadingCandidaturesTab, setLoadingCandidaturesTab] = useState(false);
  const [loadingPostesTab, setLoadingPostesTab] = useState(false);

  // Charger la section initiale à l’arrivée (si ce n’est pas le dashboard)
  useEffect(() => {
    if (initialSection === "elections") {
      onNavigate("elections");
    }
    if (initialSection === "candidatures") {
      onNavigate("candidatures");
    }
    if (initialSection === "postes") {
      onNavigate("postes");
    }
    if (initialSection === "votes") {
      onNavigate("votes");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadElectionsTab = async () => {
    try {
      setLoadingElectionsTab(true);
      const [candidaciesResult, electionsResult] = await Promise.all([
        getAllCandidaciesForAdmin(),
        getElectionsLightForAdmin()
      ]);

      if (candidaciesResult.success) {
        setCandidacies(candidaciesResult.candidacies || []);
      }
      if (electionsResult.success) {
        setElections((electionsResult.elections as any) || []);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des données:", error);
    } finally {
      setLoadingElectionsTab(false);
    }
  };

  const onNavigate = (value: string) => {
    setActiveTab(value);
    // Synchroniser l’URL (sans recharger la page)
    const url = value === "dashboard" ? "/admin" : `/admin?section=${value}`;
    router.replace(url);
    if (value === "elections" && candidacies.length === 0 && elections.length === 0 && !loadingElectionsTab) {
      loadElectionsTab();
    }
    if (value === "candidatures" && candidacies.length === 0 && !loadingCandidaturesTab) {
      (async () => {
        try {
          setLoadingCandidaturesTab(true);
          const res = await getAllCandidaciesForAdmin();
          if (res.success) setCandidacies(res.candidacies || []);
        } catch (e) {
          console.error(e);
        } finally {
          setLoadingCandidaturesTab(false);
        }
      })();
    }
    if (value === "postes" && postes.length === 0 && !loadingPostesTab) {
      (async () => {
        try {
          setLoadingPostesTab(true);
          const res = await getAllPostesTemplates();
          if (res.success && res.data) setPostes(res.data as any[]);
        } catch (e) {
          console.error(e);
        } finally {
          setLoadingPostesTab(false);
        }
      })();
    }
  };

  // Fonction pour valider/rejeter une candidature
  const handleCandidacyStatusChange = async (candidacyId: string, status: CandidacyStatus) => {
    try {
      const result = await updateCandidacyStatus(candidacyId, status);
      if (result.success) {
        // Mettre à jour l'état local
        setCandidacies(prev => 
          prev.map(c => 
            c.id === candidacyId ? { ...c, status } : c
          )
        );
      } else {
        alert(result.error || "Erreur lors de la mise à jour");
      }
    } catch (error) {
      console.error("Erreur:", error);
      alert("Erreur lors de la mise à jour");
    }
  };

  // Fonction pour clôturer une élection
  const handleCloseElection = async (electionId: string) => {
    if (confirm("Êtes-vous sûr de vouloir clôturer cette élection ?")) {
      try {
        const result = await closeElection(electionId);
        if (result.success) {
          // Mettre à jour l'état local
          setElections(prev => 
            prev.map(e => 
              e.id === electionId ? { ...e, status: ElectionStatus.Cloturee } : e
            )
          );
        } else {
          alert(result.error || "Erreur lors de la clôture");
        }
      } catch (error) {
        console.error("Erreur:", error);
        alert("Erreur lors de la clôture");
      }
    }
  };

  // Configuration des colonnes pour la table des candidatures
  const candidacyColumns = [
    columnHelper.accessor("adherent.firstname", {
      header: "Candidat",
      cell: ({ row }) => {
        const candidacy = row.original;
        return (
          <div className="flex items-center space-x-3">
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {candidacy.adherent.civility && (
                  <span className="text-sm text-gray-500 mr-1">
                    {candidacy.adherent.civility === 'Monsieur' ? 'M.' : 
                     candidacy.adherent.civility === 'Madame' ? 'Mme' : 
                     candidacy.adherent.civility === 'Mademoiselle' ? 'Mlle' : 
                     candidacy.adherent.civility}
                  </span>
                )}
                {candidacy.adherent.firstname} {candidacy.adherent.lastname}
              </div>
              <div className="text-sm text-gray-500">{candidacy.adherent.User.email}</div>
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor("position.type", {
      header: "Poste",
      cell: ({ row }) => {
        const candidacy = row.original;
        return (
          <div>
            <div className="font-medium text-gray-900 dark:text-gray-100">
              {POSTES_LABELS[candidacy.position.type as keyof typeof POSTES_LABELS]}
            </div>
            <div className="text-sm text-gray-500">{candidacy.position.election.titre}</div>
          </div>
        );
      },
    }),
    columnHelper.accessor("status", {
      header: "Statut",
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <Badge className={`${getStatusColor(status)} text-xs font-semibold`}>
            {getStatusLabel(status)}
          </Badge>
        );
      },
    }),
    columnHelper.accessor("createdAt", {
      header: "Date",
      cell: ({ row }) => {
        const date = new Date(row.getValue("createdAt"));
        return <span className="text-sm text-gray-600 dark:text-gray-300">{date.toLocaleDateString()}</span>;
      },
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const candidacy = row.original;
        return (
          <div className="flex space-x-2">
            {candidacy.status === CandidacyStatus.EnAttente && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-green-600 border-green-600 hover:bg-green-50"
                  onClick={() => handleCandidacyStatusChange(candidacy.id, CandidacyStatus.Validee)}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Valider
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-600 hover:bg-red-50"
                  onClick={() => handleCandidacyStatusChange(candidacy.id, CandidacyStatus.Rejetee)}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Rejeter
                </Button>
              </>
            )}
          </div>
        );
      },
    }),
  ];

  // Configuration de la table des candidatures
  const candidacyTable = useReactTable({
    data: candidacies,
    columns: candidacyColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Tableau de bord Admin
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mt-2">
          Gestion administrative de l'association
        </p>
      </div>

      <div className="flex gap-6">
        {/* Menu latéral */}
        <aside className="w-56 flex-shrink-0">
          <div className="border rounded-lg overflow-hidden">
            <button
              className={`w-full text-left px-4 py-3 border-b hover:bg-gray-50 dark:hover:bg-gray-800 ${activeTab === "dashboard" ? "bg-gray-100 dark:bg-gray-800 font-medium" : ""}`}
              onClick={() => onNavigate("dashboard")}
            >
              Dashboard
            </button>
            <button
              className={`w-full text-left px-4 py-3 border-b hover:bg-gray-50 dark:hover:bg-gray-800 ${activeTab === "elections" ? "bg-gray-100 dark:bg-gray-800 font-medium" : ""}`}
              onClick={() => onNavigate("elections")}
            >
              Élections
            </button>
            <button
              className={`w-full text-left px-4 py-3 border-b hover:bg-gray-50 dark:hover:bg-gray-800 ${activeTab === "candidatures" ? "bg-gray-100 dark:bg-gray-800 font-medium" : ""}`}
              onClick={() => onNavigate("candidatures")}
            >
              Candidatures
            </button>
            <button
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 ${activeTab === "postes" ? "bg-gray-100 dark:bg-gray-800 font-medium" : ""}`}
              onClick={() => onNavigate("postes")}
            >
              Postes
            </button>
            <button
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 ${activeTab === "votes" ? "bg-gray-100 dark:bg-gray-800 font-medium" : ""}`}
              onClick={() => onNavigate("votes")}
            >
              Votes
            </button>
          </div>
        </aside>

        {/* Contenu principal */}
        <main className="flex-1 space-y-6">
          {activeTab === "dashboard" && (
            <div className="space-y-6">
 
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const IconComponent = stat.icon;
          const ChangeIcon = stat.changeType === "positive" ? ArrowUpRight : ArrowDownRight;
          
          return (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  {stat.title}
                </CardTitle>
                <IconComponent className="h-4 w-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stat.value}
                </div>
                <div className="flex items-center space-x-2 mt-2">
                  <div className={`flex items-center space-x-1 ${
                    stat.changeType === "positive" ? "text-green-600" : "text-red-600"
                  }`}>
                    <ChangeIcon className="h-3 w-3" />
                    <span className="text-xs font-medium">{stat.change}</span>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {stat.description}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
 
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activités récentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Activités récentes</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivities.map((activity) => {
                const getIcon = () => {
                  switch (activity.type) {
                    case "user":
                      return <UserPlus className="h-4 w-4" />;
                    case "event":
                      return <Calendar className="h-4 w-4" />;
                    case "newsletter":
                      return <Mail className="h-4 w-4" />;
                    default:
                      return <MessageSquare className="h-4 w-4" />;
                  }
                };
 
                const getStatusColor = () => {
                  switch (activity.status) {
                    case "success":
                      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
                    case "info":
                      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
                    default:
                      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
                  }
                };
 
                return (
                  <div key={activity.id} className="flex items-center space-x-3">
                    <div className={`p-2 rounded-full ${getStatusColor()}`}>
                      {getIcon()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {activity.action}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {activity.user} • {activity.time}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
 
        {/* Événements à venir */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Événements à venir</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingEvents.map((event) => {
                const getStatusBadge = () => {
                  switch (event.status) {
                    case "confirmed":
                      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Confirmé</Badge>;
                    case "pending":
                      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">En attente</Badge>;
                    default:
                      return <Badge variant="secondary">Inconnu</Badge>;
                  }
                };
 
                return (
                  <div key={event.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                        {event.title}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(event.date).toLocaleDateString('fr-FR')} à {event.time}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {event.attendees} participants
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge()}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
 
      {/* Actions rapides */}
      <Card>
        <CardHeader>
          <CardTitle>Actions rapides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button className="flex items-center space-x-2 h-auto p-4">
              <UserPlus className="h-5 w-5" />
              <div className="text-left">
                <div className="font-medium">Ajouter un membre</div>
                <div className="text-sm opacity-80">Créer un nouveau profil</div>
              </div>
            </Button>
            
            <Button variant="outline" className="flex items-center space-x-2 h-auto p-4">
              <Calendar className="h-5 w-5" />
              <div className="text-left">
                <div className="font-medium">Créer un événement</div>
                <div className="text-sm opacity-80">Planifier une activité</div>
              </div>
            </Button>
            
            <Button variant="outline" className="flex items-center space-x-2 h-auto p-4">
              <Mail className="h-5 w-5" />
              <div className="text-left">
                <div className="font-medium">Envoyer newsletter</div>
                <div className="text-sm opacity-80">Communiquer avec les membres</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
            </div>
          )}

          {activeTab === "candidatures" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="h-5 w-5 mr-2" />
                    Candidatures
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingCandidaturesTab ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          {candidacyTable.getHeaderGroups().map(headerGroup => (
                            <tr key={headerGroup.id}>
                              {headerGroup.headers.map(header => (
                                <th
                                  key={header.id}
                                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                                >
                                  {header.isPlaceholder
                                    ? null
                                    : flexRender(
                                        header.column.columnDef.header,
                                        header.getContext()
                                      )}
                                </th>
                              ))}
                            </tr>
                          ))}
                        </thead>
                        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                          {candidacyTable.getRowModel().rows.map(row => (
                            <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                              {row.getVisibleCells().map(cell => (
                                <td key={cell.id} className="px-6 py-4 whitespace-nowrap">
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "postes" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Award className="h-5 w-5 mr-2" />
                    Postes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingPostesTab ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {postes.length === 0 ? (
                        <div className="text-sm text-gray-500">Aucun poste</div>
                      ) : (
                        postes.map((p: any) => (
                          <div key={p.id} className="flex items-center justify-between p-3 border rounded">
                            <div>
                              <div className="font-medium">{p.libelle}</div>
                              <div className="text-xs text-gray-500">{p.code} {p.description ? `• ${p.description}` : ""}</div>
                            </div>
                            <Badge className={p.actif ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                              {p.actif ? "Actif" : "Inactif"}
                            </Badge>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "elections" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Vote className="h-5 w-5 mr-2 text-blue-600" />
                    Gestion des Élections
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingElectionsTab ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Liste des élections */}
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Élections en cours</h3>
                        <div className="space-y-3">
                          {elections.map((election) => (
                            <div key={election.id} className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="font-semibold text-gray-900 dark:text-white">
                                    {election.titre}
                                  </h4>
                                  <p className="text-sm text-gray-600 dark:text-gray-300">
                                    Du {new Date(election.dateOuverture).toLocaleDateString()} au {new Date(election.dateCloture).toLocaleDateString()}
                                  </p>
                                  <div className="flex items-center space-x-4 mt-2">
                                    <Badge className={`${getStatusColor(election.status)} text-xs`}>
                                      {election.status}
                                    </Badge>
                                    {((election as any)._count?.votes ?? null) !== null && (
                                      <span className="text-xs text-gray-500">
                                        {(election as any)._count?.votes ?? 0} votes
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {election.status === ElectionStatus.Ouverte && (
                                  <Button
                                    variant="outline"
                                    className="text-red-600 border-red-600 hover:bg-red-50"
                                    onClick={() => handleCloseElection(election.id)}
                                  >
                                    <Clock className="h-4 w-4 mr-1" />
                                    Clôturer
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Table des candidatures */}
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Candidatures</h3>
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-800">
                              {candidacyTable.getHeaderGroups().map(headerGroup => (
                                <tr key={headerGroup.id}>
                                  {headerGroup.headers.map(header => (
                                    <th
                                      key={header.id}
                                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                                    >
                                      {header.isPlaceholder
                                        ? null
                                        : flexRender(
                                            header.column.columnDef.header,
                                            header.getContext()
                                          )}
                                    </th>
                                  ))}
                                </tr>
                              ))}
                            </thead>
                            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                              {candidacyTable.getRowModel().rows.map(row => (
                                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                  {row.getVisibleCells().map(cell => (
                                    <td key={cell.id} className="px-6 py-4 whitespace-nowrap">
                                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "votes" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Award className="h-5 w-5 mr-2 text-green-600" />
                    Gestion des Votes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <Award className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Fonctionnalité en développement
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      La gestion des votes sera bientôt disponible
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
