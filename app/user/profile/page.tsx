"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/components/home/Navbar";
import { Footer } from "@/components/home/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Shield, 
  Settings, 
  Edit,
  Camera,
  CheckCircle,
  Clock,
  Globe,
  Home,
  Building,
  CreditCard,
  Euro,
  Receipt,
  Vote,
  Users,
  FileText,
  ChevronRight,
  ChevronDown,
  Award,
  TrendingUp,
  History,
  Eye,
  Plus,
  Search,
  Filter,
  SortAsc,
  SortDesc,
  Grid3X3,
  List,
  X,
  DollarSign,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useUserProfile } from "@/hooks/use-user-profile";
import { PhotoUpload } from "@/components/ui/photo-upload";
import { updateUserData, getUserCandidatures, getUserVotes, getAllCandidatesForProfile } from "@/actions/user";
import { toast } from "sonner";
import { FinancialTables } from "@/components/financial/financial-tables";

// Types pour les sections du menu
type MenuSection = 'profile' | 'cotisations' | 'candidatures' | 'votes' | 'candidates' | 'settings';

export default function UserProfilePage() {
  const user = useCurrentUser();
  const { userProfile, loading: profileLoading, error: profileError } = useUserProfile();
  const [currentImage, setCurrentImage] = useState(user?.image || "");
  const [activeSection, setActiveSection] = useState<MenuSection>('profile');
  const [candidatures, setCandidatures] = useState<any[]>([]);
  const [votes, setVotes] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [cotisations, setCotisations] = useState<any[]>([]);
  const [obligationsCotisation, setObligationsCotisation] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedElection, setSelectedElection] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'election'>('date');
  const [groupByElection, setGroupByElection] = useState(true);
  // États pour la section Mes Votes
  const [votesSearchTerm, setVotesSearchTerm] = useState('');
  const [votesSelectedElection, setVotesSelectedElection] = useState<string>('all');
  const [votesSortBy, setVotesSortBy] = useState<'date' | 'name' | 'election' | 'position'>('date');
  const [votesGroupByElection, setVotesGroupByElection] = useState(true);

  // Synchroniser l'image avec les données utilisateur
  useEffect(() => {
    if (userProfile?.image) {
      setCurrentImage(userProfile.image);
    } else if (user?.image) {
      setCurrentImage(user.image);
    }
  }, [userProfile?.image, user?.image]);

  // Charger les données selon la section active
  useEffect(() => {
    const loadSectionData = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        switch (activeSection) {
          case 'cotisations':
            // Charger les cotisations et obligations depuis le profil utilisateur
            if (userProfile?.adherent) {
              setCotisations(userProfile.adherent.Cotisations || []);
              setObligationsCotisation(userProfile.adherent.ObligationsCotisation || []);
            }
            break;
          case 'candidatures':
            const candidaturesResult = await getUserCandidatures();
            if (candidaturesResult.success) {
              setCandidatures(candidaturesResult.candidatures || []);
            }
            break;
          case 'votes':
            const votesResult = await getUserVotes();
            if (votesResult.success) {
              setVotes(votesResult.votes || []);
            }
            break;
          case 'candidates':
            const candidatesResult = await getAllCandidatesForProfile();
            if (candidatesResult.success) {
              setCandidates(candidatesResult.candidates || []);
            }
            break;
        }
      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
        toast.error("Erreur lors du chargement des données");
      } finally {
        setLoading(false);
      }
    };

    loadSectionData();
  }, [activeSection, user]);

  const handleImageChange = async (imageUrl: string) => {
    setCurrentImage(imageUrl);
    try {
      const result = await updateUserData(
        {
          ...user,
          image: imageUrl
        },
        {},
        {},
        []
      );

      if (result.success) {
        toast.success("Photo mise à jour avec succès !");
        window.location.reload();
      } else {
        throw new Error(result.message || 'Erreur lors de la mise à jour');
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour de l\'image:', error);
      toast.error("Erreur lors de la mise à jour de l'image");
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-300">Veuillez vous connecter pour voir votre profil</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Actif':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Inactif':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Admin':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'Membre':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'Invite':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getCandidacyStatusColor = (status: string) => {
    switch (status) {
      case 'Validee':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'EnAttente':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'Rejetee':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getElectionStatusColor = (status: string) => {
    switch (status) {
      case 'Ouverte':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Cloturee':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      case 'EnPreparation':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getCotisationStatusColor = (status: string) => {
    switch (status) {
      case 'Valide':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'EnAttente':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'Annule':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getObligationStatusColor = (status: string) => {
    switch (status) {
      case 'Paye':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'PartiellementPaye':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'EnAttente':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'EnRetard':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getTypeCotisationLabel = (type: string) => {
    switch (type) {
      case 'Forfait':
        return 'Forfait';
      case 'Assistance':
        return 'Assistance';
      case 'Anniversaire':
        return 'Anniversaire';
      case 'Adhesion':
        return 'Adhésion';
      default:
        return type;
    }
  };

  const getMoyenPaiementLabel = (moyen: string) => {
    switch (moyen) {
      case 'Especes':
        return 'Espèces';
      case 'Cheque':
        return 'Chèque';
      case 'Virement':
        return 'Virement';
      case 'CarteBancaire':
        return 'Carte bancaire';
      default:
        return moyen;
    }
  };

  // Fonctions de filtrage et tri pour les candidats
  const getFilteredAndSortedCandidates = () => {
    let filtered = candidates;

    // Filtrage par terme de recherche
    if (searchTerm) {
      filtered = filtered.filter(candidate => 
        candidate.adherent.firstname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        candidate.adherent.lastname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        candidate.position.titre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        candidate.election.titre?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtrage par élection
    if (selectedElection !== 'all') {
      filtered = filtered.filter(candidate => candidate.election.id === selectedElection);
    }

    // Filtrage par statut
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(candidate => candidate.status === selectedStatus);
    }

    // Tri
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          const nameA = `${a.adherent.firstname} ${a.adherent.lastname}`.toLowerCase();
          const nameB = `${b.adherent.firstname} ${b.adherent.lastname}`.toLowerCase();
          return nameA.localeCompare(nameB);
        case 'election':
          return a.election.titre.localeCompare(b.election.titre);
        case 'date':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return filtered;
  };

  // Grouper les candidats par élection
  const getGroupedCandidates = () => {
    const filtered = getFilteredAndSortedCandidates();
    
    if (!groupByElection) {
      return { 'Tous les candidats': filtered };
    }

    const grouped = filtered.reduce((acc, candidate) => {
      const electionTitle = candidate.election.titre;
      if (!acc[electionTitle]) {
        acc[electionTitle] = [];
      }
      acc[electionTitle].push(candidate);
      return acc;
    }, {} as Record<string, any[]>);

    return grouped;
  };

  // Obtenir la liste unique des élections pour le filtre
  const getUniqueElections = () => {
    const elections = candidates.map(candidate => candidate.election);
    const unique = elections.filter((election, index, self) => 
      index === self.findIndex(e => e.id === election.id)
    );
    return unique;
  };

  // Fonctions dédiées aux votes: filtres/tri/regroupement
  const getUniqueElectionsFromVotes = () => {
    const elections = votes.map(v => v.election);
    const unique = elections.filter((election, index, self) =>
      index === self.findIndex(e => e.id === election.id)
    );
    return unique;
  };

  const getFilteredAndSortedVotes = () => {
    let filtered = votes;

    // Recherche texte: nom/prénom candidat, titre élection, poste
    if (votesSearchTerm) {
      const q = votesSearchTerm.toLowerCase();
      filtered = filtered.filter(v =>
        `${v.candidacy.adherent.firstname} ${v.candidacy.adherent.lastname}`.toLowerCase().includes(q) ||
        v.election.titre?.toLowerCase().includes(q) ||
        v.position.titre?.toLowerCase().includes(q)
      );
    }

    // Filtre élection
    if (votesSelectedElection !== 'all') {
      filtered = filtered.filter(v => v.election.id === votesSelectedElection);
    }

    // Tri
    filtered.sort((a, b) => {
      switch (votesSortBy) {
        case 'name': {
          const aName = `${a.candidacy.adherent.firstname} ${a.candidacy.adherent.lastname}`.toLowerCase();
          const bName = `${b.candidacy.adherent.firstname} ${b.candidacy.adherent.lastname}`.toLowerCase();
          return aName.localeCompare(bName);
        }
        case 'election':
          return a.election.titre.localeCompare(b.election.titre);
        case 'position':
          return a.position.titre.localeCompare(b.position.titre);
        case 'date':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return filtered;
  };

  const getGroupedVotes = () => {
    const filtered = getFilteredAndSortedVotes();
    if (!votesGroupByElection) {
      return { 'Tous les votes': filtered };
    }
    const grouped = filtered.reduce((acc: Record<string, any[]>, v: any) => {
      const title = v.election.titre;
      if (!acc[title]) acc[title] = [];
      acc[title].push(v);
      return acc;
    }, {} as Record<string, any[]>);
    return grouped;
  };

  // Données par défaut si certaines propriétés ne sont pas disponibles
  const userStatus = (user as any)?.status || 'Actif';
  const userRole = (user as any)?.role || 'Membre';
  const userCreatedAt = (user as any)?.createdAt || new Date().toISOString();
  const userLastLogin = (user as any)?.lastLogin || null;

  // Menu latéral
  const menuItems = [
    {
      id: 'profile' as MenuSection,
      label: 'Mon Profil',
      icon: User,
      description: 'Informations personnelles'
    },
    {
      id: 'cotisations' as MenuSection,
      label: 'Mes Cotisations',
      icon: DollarSign,
      description: 'Cotisations et obligations'
    },
    {
      id: 'candidatures' as MenuSection,
      label: 'Mes Candidatures',
      icon: FileText,
      description: 'Candidatures soumises'
    },
    {
      id: 'votes' as MenuSection,
      label: 'Mes Votes',
      icon: Vote,
      description: 'Historique des votes'
    },
    {
      id: 'candidates' as MenuSection,
      label: 'Liste des Candidats',
      icon: Users,
      description: 'Voir tous les candidats'
    },
    {
      id: 'settings' as MenuSection,
      label: 'Paramètres',
      icon: Settings,
      description: 'Gestion du compte'
    }
  ];

  // Fonction pour rendre le contenu de chaque section
  const renderSectionContent = () => {
    switch (activeSection) {
      case 'profile':
        return (
          <div className="space-y-6">
            {/* En-tête de section avec bouton principal */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Mon Profil</h2>
                <p className="text-gray-600 dark:text-gray-300">Gérez vos informations personnelles</p>
              </div>
              <Link href="/user/update">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Edit className="h-4 w-4 mr-2" />
                  Modifier le profil
                </Button>
              </Link>
            </div>

            {/* Informations de base */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  Informations Personnelles
                </CardTitle>
                <CardDescription>
                  Vos informations de base et de contact
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="font-medium">{user.email || "Non renseigné"}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-500">Nom complet</p>
                      <p className="font-medium">{user.name || "Non renseigné"}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-500">Membre depuis</p>
                      <p className="font-medium">
                        {new Date(userCreatedAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-500">Dernière connexion</p>
                      <p className="font-medium">
                        {userLastLogin ? 
                          new Date(userLastLogin).toLocaleString('fr-FR', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) :
                          "Jamais"
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Informations Adhérent */}
            {profileLoading ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Informations Adhérent
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ) : userProfile?.adherent ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Informations Adhérent
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Civilité</span>
                    <span className="font-medium">{userProfile.adherent.civility || "Non renseigné"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Prénom</span>
                    <span className="font-medium">{userProfile.adherent.firstname}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Nom</span>
                    <span className="font-medium">{userProfile.adherent.lastname}</span>
                  </div>
                </CardContent>
              </Card> 
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Informations Adhérent
                  </CardTitle>
                  <CardDescription>
                    Aucune information d'adhérent disponible
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-4">
                    <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-300">
                      Complétez vos informations d'adhérent
                    </p>
                    <Link href="/user/update">
                      <Button className="mt-4">
                        <Plus className="h-4 w-4 mr-2" />
                        Compléter mon profil
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Informations d'Adresse */}
            {profileLoading ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-blue-600" />
                    Adresses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ) : userProfile?.adherent?.Adresse && userProfile.adherent.Adresse.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-blue-600" />
                    Adresses
                  </CardTitle>
                  <CardDescription>
                    Vos adresses enregistrées
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {userProfile.adherent.Adresse.map((adresse, index) => (
                    <div key={adresse.id} className="border rounded-lg p-4 space-y-3">
                      {index > 0 && <hr className="my-4" />}
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-3">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="text-sm text-gray-500">Numéro</p>
                            <p className="font-medium">{adresse.streetnum || "Non renseigné"}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <Home className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="text-sm text-gray-500">Rue</p>
                            <p className="font-medium">{adresse.street1 || "Non renseigné"}</p>
                          </div>
                        </div>
                      </div>

                      {adresse.street2 && (
                        <div className="flex items-center gap-3">
                          <Building className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="text-sm text-gray-500">Complément</p>
                            <p className="font-medium">{adresse.street2}</p>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex items-center gap-3">
                          <Globe className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="text-sm text-gray-500">Code postal</p>
                            <p className="font-medium">{adresse.codepost || "Non renseigné"}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="text-sm text-gray-500">Ville</p>
                            <p className="font-medium">{adresse.city || "Non renseigné"}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <Globe className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="text-sm text-gray-500">Pays</p>
                            <p className="font-medium">{adresse.country || "Non renseigné"}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t">
                        <div className="text-xs text-gray-500">
                          Créée le {new Date(adresse.createdAt).toLocaleDateString('fr-FR')}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Edit className="h-3 w-3" />
                          <span>Modifiable</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-blue-600" />
                    Adresses
                  </CardTitle>
                  <CardDescription>
                    Aucune adresse enregistrée
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-4">
                    <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-300 mb-4">
                      Ajoutez votre adresse pour compléter votre profil
                    </p>
                    <Link href="/user/update">
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Ajouter une adresse
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Informations des Téléphones */}
            {profileLoading ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5 text-blue-600" />
                    Téléphones
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  </div>
                </CardContent>
              </Card>
            ) : userProfile?.adherent?.Telephones && userProfile.adherent.Telephones.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5 text-blue-600" />
                    Téléphones
                  </CardTitle>
                  <CardDescription>
                    Vos numéros de téléphone
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {userProfile.adherent.Telephones.map((telephone, index) => (
                    <div key={telephone.id} className="border rounded-lg p-4 space-y-3">
                      {index > 0 && <hr className="my-4" />}
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Phone className="h-5 w-5 text-gray-500" />
                          <div>
                            <p className="text-sm text-gray-500">Numéro</p>
                            <p className="font-medium text-lg">{telephone.numero}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {telephone.estPrincipal && (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Principal
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {telephone.type}
                          </Badge>
                        </div>
                      </div>

                      {telephone.description && (
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="text-sm text-gray-500">Description</p>
                            <p className="font-medium text-sm">{telephone.description}</p>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between items-center pt-2 border-t">
                        <div className="text-xs text-gray-500">
                          Ajouté le {new Date(telephone.createdAt).toLocaleDateString('fr-FR')}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Edit className="h-3 w-3" />
                          <span>Modifiable</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5 text-blue-600" />
                    Téléphones
                  </CardTitle>
                  <CardDescription>
                    Aucun numéro de téléphone enregistré
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-4">
                    <Phone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-300 mb-4">
                      Ajoutez vos numéros de téléphone pour être contacté
                    </p>
                    <Link href="/user/update">
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Ajouter un téléphone
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Note explicative */}
            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center">
                      <Edit className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                      Comment modifier vos informations ?
                    </h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Utilisez le bouton <strong>"Modifier le profil"</strong> en haut de cette page pour accéder au formulaire de modification. 
                      Vous pourrez y modifier toutes vos informations : adhérent, adresses et téléphones.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'cotisations':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Mes Cotisations</h2>
                <p className="text-gray-600 dark:text-gray-300">Historique des cotisations et obligations</p>
              </div>
            </div>

            <FinancialTables 
              cotisations={cotisations}
              obligations={obligationsCotisation}
              loading={loading}
            />
          </div>
        );

      case 'candidatures':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Mes Candidatures</h2>
                <p className="text-gray-600 dark:text-gray-300">Historique de vos candidatures</p>
              </div>
              <Link href="/candidatures">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle candidature
                </Button>
              </Link>
            </div>

            {loading ? (
              <Card>
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ) : candidatures.length > 0 ? (
              <div className="space-y-4">
                {candidatures.map((candidacy) => (
                  <Card key={candidacy.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {candidacy.position.titre}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            {candidacy.election.titre}
                          </p>
                        </div>
                        <Badge className={getCandidacyStatusColor(candidacy.status)}>
                          {candidacy.status === 'Validee' ? 'Validée' : 
                           candidacy.status === 'EnAttente' ? 'En attente' : 'Rejetée'}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600 dark:text-gray-300">Date de candidature:</span>
                          <span className="ml-2 font-medium">
                            {new Date(candidacy.createdAt).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-300">Statut de l'élection:</span>
                          <Badge className={`ml-2 text-xs ${getElectionStatusColor(candidacy.election.status)}`}>
                            {candidacy.election.status === 'Ouverte' ? 'Ouverte' :
                             candidacy.election.status === 'Cloturee' ? 'Clôturée' : 'En préparation'}
                          </Badge>
                        </div>
                      </div>

                      {candidacy.motivation && (
                        <div className="mt-4">
                          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">Motivation:</p>
                          <p className="text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                            {candidacy.motivation}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-6 text-center">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Aucune candidature
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    Vous n'avez pas encore soumis de candidature.
                  </p>
                  <Link href="/candidatures">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Soumettre une candidature
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 'votes':
        const groupedVotes = getGroupedVotes();
        const uniqueVoteElections = getUniqueElectionsFromVotes();
        const votesCount = getFilteredAndSortedVotes().length;
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Mes Votes</h2>
                <p className="text-gray-600 dark:text-gray-300">{votesCount} vote{votesCount > 1 ? 's' : ''} trouvé{votesCount > 1 ? 's' : ''}</p>
              </div>
              <div className="flex gap-2">
                <Link href="/vote">
                  <Button>
                    <Vote className="h-4 w-4 mr-2" />
                    Voter maintenant
                  </Button>
                </Link>
                <Button
                  variant={votesGroupByElection ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setVotesGroupByElection(!votesGroupByElection)}
                >
                  {votesGroupByElection ? <Grid3X3 className="h-4 w-4 mr-2" /> : <List className="h-4 w-4 mr-2" />}
                  {votesGroupByElection ? 'Groupé' : 'Liste'}
                </Button>
              </div>
            </div>

            {/* Barre de recherche et filtres */}
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Recherche */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Rechercher un vote (nom, poste, élection)..."
                      value={votesSearchTerm}
                      onChange={(e) => setVotesSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {votesSearchTerm && (
                      <button
                        onClick={() => setVotesSearchTerm('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Filtre élection */}
                  <select
                    value={votesSelectedElection}
                    onChange={(e) => setVotesSelectedElection(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">Toutes les élections</option>
                    {uniqueVoteElections.map((election: any) => (
                      <option key={election.id} value={election.id}>{election.titre}</option>
                    ))}
                  </select>

                  {/* Tri */}
                  <select
                    value={votesSortBy}
                    onChange={(e) => setVotesSortBy(e.target.value as 'date' | 'name' | 'election' | 'position')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="date">Tri par date</option>
                    <option value="name">Tri par nom candidat</option>
                    <option value="position">Tri par poste</option>
                    <option value="election">Tri par élection</option>
                  </select>

                  {/* Bouton reset filtres */}
                  <div className="flex items-center">
                    {(votesSearchTerm || votesSelectedElection !== 'all' || votesSortBy !== 'date') && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setVotesSearchTerm('');
                          setVotesSelectedElection('all');
                          setVotesSortBy('date');
                        }}
                        className="w-full"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Effacer les filtres
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contenu principal */}
            {loading ? (
              <Card>
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ) : Object.keys(groupedVotes).length > 0 ? (
              <div className="space-y-6">
                {Object.entries(groupedVotes).map(([electionTitle, votesInElection]) => {
                  const votesList = votesInElection as any[];
                  return (
                    <div key={electionTitle}>
                      {votesGroupByElection && (
                        <div className="flex items-center gap-3 mb-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{electionTitle}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-300">{votesList.length} vote{votesList.length > 1 ? 's' : ''}</p>
                          </div>
                          <Badge className={getElectionStatusColor(votesList[0]?.election.status)}>
                            {votesList[0]?.election.status === 'Ouverte' ? 'Ouverte' : votesList[0]?.election.status === 'Cloturee' ? 'Clôturée' : 'En préparation'}
                          </Badge>
                        </div>
                      )}

                      <div className="space-y-4">
                        {votesList.map((vote: any) => (
                          <Card key={vote.id} className="hover:shadow-lg transition-shadow">
                            <CardContent className="p-6">
                              <div className="flex justify-between items-start mb-4">
                                <div>
                                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{vote.position.titre}</h3>
                                  {!votesGroupByElection && (
                                    <p className="text-sm text-gray-600 dark:text-gray-300">{vote.election.titre}</p>
                                  )}
                                </div>
                                <Badge className={getElectionStatusColor(vote.election.status)}>
                                  {vote.election.status === 'Ouverte' ? 'Ouverte' : vote.election.status === 'Cloturee' ? 'Clôturée' : 'En préparation'}
                                </Badge>
                              </div>

                              <div className="flex items-center gap-4 mb-4">
                                <Avatar className="w-12 h-12">
                                  <AvatarImage src={vote.candidacy.adherent.User.image || undefined} alt={`${vote.candidacy.adherent.firstname} ${vote.candidacy.adherent.lastname}`} />
                                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-sm">
                                    {vote.candidacy.adherent.firstname?.[0]}{vote.candidacy.adherent.lastname?.[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-semibold text-gray-900 dark:text-white">{vote.candidacy.adherent.firstname} {vote.candidacy.adherent.lastname}</p>
                                  <p className="text-sm text-gray-600 dark:text-gray-300">{vote.candidacy.adherent.civility}</p>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-600 dark:text-gray-300">Date du vote:</span>
                                  <span className="ml-2 font-medium">{new Date(vote.createdAt).toLocaleDateString('fr-FR')}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600 dark:text-gray-300">Heure:</span>
                                  <span className="ml-2 font-medium">{new Date(vote.createdAt).toLocaleTimeString('fr-FR')}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600 dark:text-gray-300">Candidat:</span>
                                  <span className="ml-2 font-medium">{vote.candidacy.adherent.firstname} {vote.candidacy.adherent.lastname}</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="p-6 text-center">
                  <Vote className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Aucun vote</h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">Vous n'avez pas encore voté dans une élection.</p>
                  <Link href="/vote">
                    <Button>
                      <Vote className="h-4 w-4 mr-2" />
                      Voter maintenant
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 'candidates':
        const groupedCandidates = getGroupedCandidates();
        const uniqueElections = getUniqueElections();
        const filteredCount = getFilteredAndSortedCandidates().length;

        return (
          <div className="space-y-6">
            {/* En-tête avec titre et statistiques */}
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Liste des Candidats</h2>
                <p className="text-gray-600 dark:text-gray-300">
                  {filteredCount} candidat{filteredCount > 1 ? 's' : ''} trouvé{filteredCount > 1 ? 's' : ''}
                  {searchTerm && ` pour "${searchTerm}"`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant={groupByElection ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setGroupByElection(!groupByElection)}
                >
                  {groupByElection ? <Grid3X3 className="h-4 w-4 mr-2" /> : <List className="h-4 w-4 mr-2" />}
                  {groupByElection ? 'Groupé' : 'Liste'}
                </Button>
              </div>
            </div>

            {/* Barre de recherche et filtres */}
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Recherche textuelle */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Rechercher un candidat..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Filtre par élection */}
                  <select
                    value={selectedElection}
                    onChange={(e) => setSelectedElection(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">Toutes les élections</option>
                    {uniqueElections.map((election) => (
                      <option key={election.id} value={election.id}>
                        {election.titre}
                      </option>
                    ))}
                  </select>

                  {/* Filtre par statut */}
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">Tous les statuts</option>
                    <option value="Validee">Validées</option>
                    <option value="EnAttente">En attente</option>
                    <option value="Rejetee">Rejetées</option>
                  </select>

                  {/* Tri */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'date' | 'name' | 'election')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="date">Tri par date</option>
                    <option value="name">Tri par nom</option>
                    <option value="election">Tri par élection</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Contenu principal */}
            {loading ? (
              <Card>
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ) : Object.keys(groupedCandidates).length > 0 ? (
              <div className="space-y-6">
                {Object.entries(groupedCandidates).map(([electionTitle, candidatesInElection]) => {
                  const candidates = candidatesInElection as any[];
                  return (
                    <div key={electionTitle}>
                      {/* En-tête de groupe */}
                      {groupByElection && (
                        <div className="flex items-center gap-3 mb-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                              {electionTitle}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              {candidates.length} candidat{candidates.length > 1 ? 's' : ''}
                            </p>
                          </div>
                          <Badge className={getElectionStatusColor(candidates[0]?.election.status)}>
                            {candidates[0]?.election.status === 'Ouverte' ? 'Ouverte' :
                             candidates[0]?.election.status === 'Cloturee' ? 'Clôturée' : 'En préparation'}
                          </Badge>
                        </div>
                      )}

                      {/* Liste des candidats */}
                      <div className="space-y-4">
                        {candidates.map((candidate: any) => (
                        <Card key={candidate.id} className="hover:shadow-lg transition-shadow">
                          <CardContent className="p-6">
                            <div className="flex items-center gap-4 mb-4">
                              <Avatar className="w-16 h-16">
                                <AvatarImage
                                  src={candidate.adherent.User.image || undefined}
                                  alt={`${candidate.adherent.firstname} ${candidate.adherent.lastname}`}
                                />
                                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-lg">
                                  {candidate.adherent.firstname?.[0]}{candidate.adherent.lastname?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                  {candidate.adherent.firstname} {candidate.adherent.lastname}
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                  {candidate.adherent.civility}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {candidate.adherent.User.email}
                                </p>
                              </div>
                              <div className="text-right space-y-2">
                                <Badge className={getCandidacyStatusColor(candidate.status)}>
                                  {candidate.status === 'Validee' ? 'Validée' : 
                                   candidate.status === 'EnAttente' ? 'En attente' : 'Rejetée'}
                                </Badge>
                                {!groupByElection && (
                                  <Badge className={`text-xs ${getElectionStatusColor(candidate.election.status)}`}>
                                    {candidate.election.status === 'Ouverte' ? 'Ouverte' :
                                     candidate.election.status === 'Cloturee' ? 'Clôturée' : 'En préparation'}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-gray-600 dark:text-gray-300">Poste:</span>
                                <span className="ml-2 font-medium">{candidate.position.titre}</span>
                              </div>
                              {!groupByElection && (
                                <div>
                                  <span className="text-gray-600 dark:text-gray-300">Élection:</span>
                                  <span className="ml-2 font-medium">{candidate.election.titre}</span>
                                </div>
                              )}
                              <div>
                                <span className="text-gray-600 dark:text-gray-300">Date de candidature:</span>
                                <span className="ml-2 font-medium">
                                  {new Date(candidate.createdAt).toLocaleDateString('fr-FR')}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600 dark:text-gray-300">Heure:</span>
                                <span className="ml-2 font-medium">
                                  {new Date(candidate.createdAt).toLocaleTimeString('fr-FR')}
                                </span>
                              </div>
                            </div>

                            {candidate.motivation && (
                              <div className="mt-4">
                                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">Motivation:</p>
                                <p className="text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                                  {candidate.motivation}
                                </p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="p-6 text-center">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {searchTerm || selectedElection !== 'all' || selectedStatus !== 'all' 
                      ? 'Aucun résultat' 
                      : 'Aucun candidat'}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    {searchTerm || selectedElection !== 'all' || selectedStatus !== 'all'
                      ? 'Aucun candidat ne correspond à vos critères de recherche.'
                      : 'Aucune candidature n\'a été soumise pour le moment.'}
                  </p>
                  {(searchTerm || selectedElection !== 'all' || selectedStatus !== 'all') && (
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setSearchTerm('');
                        setSelectedElection('all');
                        setSelectedStatus('all');
                      }}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Effacer les filtres
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 'settings':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Paramètres du Compte</h2>
              <p className="text-gray-600 dark:text-gray-300">Gérez vos préférences et paramètres</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-blue-600" />
                    Informations du Compte
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Statut</span>
                    <Badge className={getStatusColor(userStatus)}>
                      {userStatus}
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Rôle</span>
                    <Badge className={getRoleColor(userRole)}>
                      {userRole}
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">ID Utilisateur</span>
                    <span className="text-sm font-medium font-mono">
                      {user.id?.slice(0, 8) || "Non disponible"}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Image de profil</span>
                    <span className="text-sm font-medium">
                      {user.image ? "Définie" : "Non définie"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-blue-600" />
                    Actions Rapides
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Link href="/user/update" className="block">
                    <Button className="w-full" variant="outline">
                      <Edit className="h-4 w-4 mr-2" />
                      Modifier le profil
                    </Button>
                  </Link>
                  <Button className="w-full" variant="outline">
                    <Shield className="h-4 w-4 mr-2" />
                    Sécurité
                  </Button>
                  <Button className="w-full" variant="outline">
                    <Settings className="h-4 w-4 mr-2" />
                    Préférences
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative py-16 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="relative">
              <PhotoUpload
                currentImage={currentImage}
                userName={user.name || ""}
                onImageChange={handleImageChange}
                size="lg"
              />
            </div>
            
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl md:text-4xl font-bold mb-2">
                {user.name || "Utilisateur"}
              </h1>
              <p className="text-xl text-blue-100 mb-4">{user.email}</p>
              <div className="flex flex-wrap justify-center md:justify-start gap-3">
                <Badge className={getStatusColor(userStatus)}>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  {userStatus}
                </Badge>
                <Badge className={getRoleColor(userRole)}>
                  <Shield className="h-4 w-4 mr-1" />
                  {userRole}
                </Badge>
              </div>
            </div>
            
            <div className="flex gap-3">
              <Link href="/user/update">
                <Button variant="outline" className="border-white text-white hover:bg-white/10">
                  <Edit className="h-4 w-4 mr-2" />
                  Modifier
                </Button>
              </Link>
              <Button variant="outline" className="border-white text-white hover:bg-white/10">
                <Settings className="h-4 w-4 mr-2" />
                Paramètres
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Contenu principal avec menu latéral */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            
            {/* Menu latéral */}
            <div className="lg:col-span-1">
              <Card className="sticky top-8">
                <CardHeader>
                  <CardTitle className="text-lg">Mon Compte</CardTitle>
                  <CardDescription>
                    Gérez votre profil et vos activités
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <nav className="space-y-1">
                    {menuItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeSection === item.id;
                      
                      return (
                        <button
                          key={item.id}
                          onClick={() => setActiveSection(item.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                            isActive
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-r-2 border-blue-600'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                          <div className="flex-1">
                            <div className="font-medium">{item.label}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {item.description}
                            </div>
                          </div>
                          {isActive ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      );
                    })}
                  </nav>
                </CardContent>
              </Card>
            </div>

            {/* Contenu principal */}
            <div className="lg:col-span-3">
              {renderSectionContent()}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}