"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LoginButton } from "@/components/auth/login-button";
import { 
  Vote, 
  CheckCircle2, 
  Clock, 
  Calendar,
  Users,
  AlertCircle,
  UserCheck,
  Shield,
  Eye,
  EyeOff,
  Award,
  User,
  Mail,
  FileText,
  Target,
  Lock,
  CheckCircle,
  XCircle,
  LogIn,
  UserX,
  History,
  TrendingUp,
  BarChart3,
  RefreshCw,
  UserPlus,
  VoteIcon,
  CalendarDays,
  Timer,
  CheckCircleIcon
} from "lucide-react";
import { 
  getElections,
  vote,
  getUserVotes,
  getUserVoteHistory
} from "@/actions/elections";
import { POSTES_LABELS } from "@/lib/elections-constants";
import { ElectionStatus, PositionType, UserRole } from "@prisma/client";
import Link from "next/link";

interface Election {
  id: string;
  titre: string;
  status: ElectionStatus;
  dateOuverture: string;
  dateCloture: string;
  positions: Position[];
}

interface Position {
  id: string;
  type: PositionType;
  titre: string;
  candidacies: Candidacy[];
}

interface Candidacy {
  id: string;
  status: string;
  motivation?: string;
  programme?: string;
  adherent: {
    firstname: string;
    lastname: string;
    User: {
      name: string;
      email: string;
      image?: string;
    };
  };
}

interface VoteHistory {
  election: {
    id: string;
    titre: string;
    status: ElectionStatus;
    dateOuverture: string;
    dateCloture: string;
  };
  positions: Array<{
    id: string;
    type: PositionType;
    votes: Array<{
      id: string;
      status: string;
      candidacy?: {
        adherent: {
          firstname: string;
          lastname: string;
        };
      };
    }>;
  }>;
}

export default function VotePage() {
  const { data: session, status } = useSession();
  const [elections, setElections] = useState<Election[]>([]);
  const [voteHistory, setVoteHistory] = useState<VoteHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedElection, setSelectedElection] = useState<string>("");
  const [votes, setVotes] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [existingVotes, setExistingVotes] = useState<any[]>([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [voteProgress, setVoteProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (session?.user) {
      loadData();
    }
  }, [session]);

  // Recharger la session si nécessaire
  useEffect(() => {
    if (mounted && status === "unauthenticated") {
      // Si l'utilisateur n'est pas connecté, on laisse la page d'accès refusé s'afficher
      return;
    }
  }, [mounted, status]);

  useEffect(() => {
    if (selectedElection) {
      loadExistingVotes();
    }
  }, [selectedElection]);

  const selectedElectionData = elections.find(e => e.id === selectedElection);

  useEffect(() => {
    if (selectedElectionData) {
      console.log("Élection sélectionnée:", selectedElectionData);
      console.log("Positions:", selectedElectionData.positions);
      selectedElectionData.positions.forEach((position, index) => {
        console.log(`Position ${index}:`, position);
        console.log(`Candidats pour position ${index}:`, position.candidacies);
      });
    }
  }, [selectedElectionData]);

  useEffect(() => {
    if (selectedElectionData) {
      const totalPositions = selectedElectionData.positions.length;
      const votedPositions = Object.keys(votes).length;
      setVoteProgress(totalPositions > 0 ? (votedPositions / totalPositions) * 100 : 0);
    }
  }, [votes, selectedElectionData]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Charger les élections actuelles et l'historique en parallèle
      const [electionsResult, historyResult] = await Promise.all([
        getElections(),
        getUserVoteHistory()
      ]);

      if (electionsResult.success && electionsResult.elections) {
        console.log("Élections chargées:", electionsResult.elections);
        // Filtrer seulement les élections ouvertes au vote
        const openElections = electionsResult.elections.filter(
          (election: Election) => election.status === ElectionStatus.Ouverte
        );
        console.log("Élections ouvertes:", openElections);
        setElections(openElections);
        
        // Sélectionner automatiquement la première élection si disponible
        if (openElections.length > 0) {
          console.log("Première élection sélectionnée:", openElections[0]);
          setSelectedElection(openElections[0].id);
        }
      } else {
        console.error("Erreur lors du chargement des élections:", electionsResult.error);
        setError(electionsResult.error || "Erreur lors du chargement des élections");
      }

      if (historyResult.success && historyResult.elections) {
        setVoteHistory(historyResult.elections);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des données:", error);
      setError("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const loadExistingVotes = async () => {
    try {
      const result = await getUserVotes(selectedElection);
      if (result.success && result.votes) {
        setExistingVotes(result.votes);
        
        // Convertir les votes existants en format pour l'état local
        const votesMap: Record<string, string> = {};
        result.votes.forEach((vote: any) => {
          if (vote.candidacyId) {
            votesMap[vote.positionId] = vote.candidacyId;
          } else {
            votesMap[vote.positionId] = "blanc";
          }
        });
        setVotes(votesMap);
        setHasVoted(result.votes.length > 0);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des votes existants:", error);
    }
  };

  const handleVote = async (positionId: string, candidacyId: string | null) => {
    if (!selectedElection || !mounted) return;

    try {
      setSubmitting(true);
      const result = await vote(selectedElection, positionId, candidacyId || undefined);
      
      if (result.success) {
        // Mettre à jour l'état local
        setVotes(prev => ({
          ...prev,
          [positionId]: candidacyId || "blanc"
        }));
        
        if (mounted) {
          alert("Vote enregistré avec succès !");
        }
      } else {
        if (mounted) {
          alert(result.error || "Erreur lors de l'enregistrement du vote");
        }
      }
    } catch (error) {
      console.error("Erreur lors du vote:", error);
      if (mounted) {
        alert("Erreur lors de l'enregistrement du vote");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getVoteSummary = () => {
    if (!selectedElectionData) return [];
    
    return selectedElectionData.positions.map(position => {
      const voteValue = votes[position.id];
      const candidate = position.candidacies?.find(c => c.id === voteValue);
      
      return {
        position: POSTES_LABELS[position.type as keyof typeof POSTES_LABELS],
        vote: voteValue === "blanc" ? "Vote blanc" : candidate ? `${candidate.adherent.firstname} ${candidate.adherent.lastname}` : "Non voté"
      };
    });
  };

  const isVoteComplete = () => {
    if (!selectedElectionData) return false;
    return selectedElectionData.positions.every(position => votes[position.id]);
  };

  const getStatusColor = (status: ElectionStatus) => {
    switch (status) {
      case ElectionStatus.Ouverte:
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case ElectionStatus.Cloturee:
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case ElectionStatus.Preparation:
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case ElectionStatus.Annulee:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getStatusLabel = (status: ElectionStatus) => {
    switch (status) {
      case ElectionStatus.Ouverte:
        return "Ouverte";
      case ElectionStatus.Cloturee:
        return "Clôturée";
      case ElectionStatus.Preparation:
        return "En préparation";
      case ElectionStatus.Annulee:
        return "Annulée";
      default:
        return "Inconnu";
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Vérification d'accès - seulement les adhérents connectés ou les admins
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-4">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600 mx-auto"></div>
              <Shield className="h-6 w-6 text-indigo-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Initialisation sécurisée</h3>
              <p className="text-gray-600 dark:text-gray-300">Vérification des autorisations...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-4">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600 mx-auto"></div>
              <User className="h-6 w-6 text-indigo-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Vérification de l'authentification</h3>
              <p className="text-gray-600 dark:text-gray-300">Vérification de votre identité...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Accès refusé si pas connecté ou pas membre/admin
  if (!session?.user || (session.user.role !== UserRole.Membre && session.user.role !== UserRole.Admin)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="container mx-auto px-4 py-6 lg:py-8">
          <div className="text-center py-20">
            <div className="w-24 h-24 bg-gradient-to-r from-red-100 to-orange-100 dark:from-red-900/20 dark:to-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-8">
              <UserX className="h-12 w-12 text-red-500" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Connexion requise
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
              Vous devez être connecté en tant que membre pour accéder à cette page de vote.
            </p>
            
            <div className="bg-white dark:bg-slate-800 rounded-xl p-8 shadow-xl border border-gray-200 dark:border-gray-700 max-w-md mx-auto">
              <div className="space-y-4">
                <div className="flex items-center justify-center text-sm text-gray-600 dark:text-gray-300 mb-6">
                  <Shield className="h-4 w-4 mr-2 text-indigo-600" />
                  <span>Vote réservé aux membres</span>
                </div>
                
                <LoginButton mode="redirect">
                  <Button className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105">
                    <LogIn className="h-5 w-5 mr-2" />
                    Se connecter
                  </Button>
                </LoginButton>
                
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  Vous n'avez pas de compte ? 
                  <a href="/auth/sign-up" className="text-indigo-600 hover:text-indigo-700 ml-1">
                    Créer un compte
                  </a>
                </p>
              </div>
            </div>
            
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/20 dark:to-emerald-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Shield className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Sécurisé</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">Vote cryptographiquement protégé</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Lock className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Anonyme</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">Votre identité reste confidentielle</p>
              </div>
            <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Transparent</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">Processus démocratique ouvert</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="container mx-auto px-4 py-6 lg:py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <Vote className="h-8 w-8 text-white" />
              </div>
              <p className="text-lg text-gray-600 dark:text-gray-300">Chargement des élections...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="container mx-auto px-4 py-6 lg:py-8">
        <div className="text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Vote className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Erreur</h2>
            <p className="text-gray-600 dark:text-gray-300">{error}</p>
            <Button 
              onClick={loadData}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Réessayer
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container mx-auto px-4 py-6 lg:py-8">
        {/* En-tête */}
        <div className="text-center mb-8 lg:mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 lg:w-20 lg:h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mb-4 lg:mb-6 shadow-lg">
            <Vote className="h-8 w-8 lg:h-10 lg:w-10 text-white" />
          </div>
          <h1 className="text-3xl lg:text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Vote Électronique
          </h1>
          <p className="text-base lg:text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed mt-4">
            Exprimez votre choix démocratique pour les postes du comité directeur. 
            Votre vote est sécurisé, anonyme et transparent.
          </p>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <VoteIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-2xl font-bold text-blue-900 dark:text-blue-100">{elections.length}</h3>
              <p className="text-blue-700 dark:text-blue-300">Élections ouvertes</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <History className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-2xl font-bold text-green-900 dark:text-green-100">{voteHistory.length}</h3>
              <p className="text-green-700 dark:text-green-300">Élections dans l'historique</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-800">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                {voteHistory.reduce((total, election) => total + election.positions.reduce((posTotal: number, pos: any) => posTotal + pos.votes.length, 0), 0)}
              </h3>
              <p className="text-purple-700 dark:text-purple-300">Votes effectués</p>
            </CardContent>
          </Card>
        </div>

        {/* Onglets */}
        <div className="flex justify-center mb-8">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-2 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex space-x-2">
              <Button
                onClick={() => setActiveTab('current')}
                className={`px-6 py-3 rounded-lg transition-all duration-300 ${
                  activeTab === 'current'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                    : 'text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                }`}
              >
                <VoteIcon className="h-4 w-4 mr-2" />
                Élections actuelles
              </Button>
              <Button
                onClick={() => setActiveTab('history')}
                className={`px-6 py-3 rounded-lg transition-all duration-300 ${
                  activeTab === 'history'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                    : 'text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                }`}
              >
                <History className="h-4 w-4 mr-2" />
                Historique des votes
              </Button>
            </div>
          </div>
        </div>

        {/* Contenu conditionnel */}
        {activeTab === 'current' ? (
          <>
        {/* Sélection d'élection */}
        {elections.length > 1 && (
              <Card className="mb-8 shadow-xl border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white flex items-center justify-center">
                    <Target className="h-6 w-6 mr-3 text-blue-600" />
                    Sélectionner une élection
                  </CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-300">
                    Choisissez l'élection pour laquelle vous souhaitez voter
                  </CardDescription>
            </CardHeader>
            <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {elections.map((election) => (
                  <div
                    key={election.id}
                        className={`group relative p-6 border-2 rounded-xl cursor-pointer transition-all duration-300 transform hover:scale-105 ${
                      selectedElection === election.id
                            ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 shadow-lg'
                            : 'border-gray-200 hover:border-blue-300 hover:shadow-md bg-white dark:bg-slate-700'
                    }`}
                    onClick={() => setSelectedElection(election.id)}
                  >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center">
                            <div className={`w-3 h-3 rounded-full mr-3 ${
                              selectedElection === election.id ? 'bg-blue-500' : 'bg-gray-300'
                            }`} />
                            <Award className="h-5 w-5 text-blue-600" />
                          </div>
                          {selectedElection === election.id && (
                            <CheckCircle className="h-6 w-6 text-blue-600" />
                          )}
                        </div>
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 transition-colors">
                          {election.titre}
                        </h3>
                        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-2" />
                            <span>Ouverture: {new Date(election.dateOuverture).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-2" />
                            <span>Clôture: {new Date(election.dateCloture).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center">
                            <Users className="h-4 w-4 mr-2" />
                            <span>{election.positions.length} poste(s) à pourvoir</span>
                          </div>
                        </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

            {/* Indicateur de progression */}
            {selectedElectionData && (
              <Card className="mb-8 shadow-xl border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <Target className="h-5 w-5 mr-2 text-blue-600" />
                      <span className="font-semibold text-gray-900 dark:text-white">Progression du vote</span>
                    </div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      {Math.round(voteProgress)}% complété
                    </span>
                  </div>
                  <Progress value={voteProgress} className="h-3 mb-2" />
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{Object.keys(votes).length} poste(s) voté(s)</span>
                    <span>{selectedElectionData.positions.length} poste(s) total</span>
                  </div>
                </CardContent>
              </Card>
            )}

        {/* Formulaire de vote */}
        {selectedElectionData && (
              <Card className="shadow-xl border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                <CardHeader className="text-center pb-6">
                  <div className="flex items-center justify-center mb-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mr-4">
                      <Award className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
                        {selectedElectionData.titre}
                      </CardTitle>
                      <CardDescription className="text-gray-600 dark:text-gray-300">
                        Élection en cours
                  </CardDescription>
                </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-600 dark:text-gray-300 mb-6">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-blue-600" />
                      <span>Ouverture: {new Date(selectedElectionData.dateOuverture).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-2 text-blue-600" />
                      <span>Clôture: {new Date(selectedElectionData.dateCloture).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-2 text-blue-600" />
                      <span>{selectedElectionData.positions.length} poste(s)</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Badge className="bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 dark:from-green-900 dark:to-emerald-900 dark:text-green-200 px-4 py-2">
                      <CheckCircle className="h-4 w-4 mr-2" />
                    Ouverte au vote
                  </Badge>
                  {hasVoted && (
                      <Badge className="bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 dark:from-blue-900 dark:to-indigo-900 dark:text-blue-200 px-4 py-2">
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                      Vous avez voté
                    </Badge>
                  )}
                    <Badge className="bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 dark:from-purple-900 dark:to-pink-900 dark:text-purple-200 px-4 py-2">
                      <Shield className="h-4 w-4 mr-2" />
                      Vote sécurisé
                    </Badge>
              </div>
            </CardHeader>
                
            <CardContent>
                  <div className="space-y-10">
                    {selectedElectionData.positions.map((position, index) => (
                      <div key={position.id} className="relative">
                        {/* En-tête de position */}
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-t-xl p-6 border border-blue-200 dark:border-blue-700">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mr-4">
                                <span className="text-white font-bold text-lg">{index + 1}</span>
                              </div>
                              <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                  {POSTES_LABELS[position.type as keyof typeof POSTES_LABELS]}
                      </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        Sélectionnez votre candidat ou votez blanc
                      </p>
                                <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                                  <div className="flex items-center">
                                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                                    <span>{position.candidacies?.filter(c => c.status === "Validee").length || 0} candidat(s) validé(s)</span>
                                  </div>
                                  {position.candidacies?.filter(c => c.status !== "Validee").length > 0 && (
                                    <div className="flex items-center">
                                      <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
                                      <span>{position.candidacies?.filter(c => c.status !== "Validee").length} candidat(s) en attente</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            {votes[position.id] && (
                              <div className="flex items-center text-green-600 dark:text-green-400">
                                <CheckCircle className="h-5 w-5 mr-2" />
                                <span className="font-medium">Voté</span>
                              </div>
                            )}
                          </div>
                    </div>

                        {/* Contenu de vote */}
                        <div className="bg-white dark:bg-slate-700 rounded-b-xl border-x border-b border-gray-200 dark:border-gray-600 p-6">
                    <RadioGroup
                      value={votes[position.id] || ""}
                      onValueChange={(value) => {
                        if (value === "blanc") {
                          handleVote(position.id, null);
                        } else {
                          handleVote(position.id, value);
                        }
                      }}
                      className="space-y-4"
                    >
                      {/* Vote blanc */}
                            <div className={`group relative overflow-hidden rounded-xl border-2 transition-all duration-300 cursor-pointer ${
                              votes[position.id] === "blanc" 
                                ? 'border-gray-400 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800 dark:to-slate-800 shadow-lg' 
                                : 'border-gray-200 hover:border-gray-300 hover:shadow-md bg-white dark:bg-slate-600'
                            }`}>
                              <div className="p-6">
                          <div className="flex items-center">
                                  <RadioGroupItem value="blanc" id={`blanc-${position.id}`} className="mr-4" />
                                  <div className="flex items-center flex-1">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 transition-colors ${
                                      votes[position.id] === "blanc" 
                                        ? 'bg-gray-300 dark:bg-gray-600' 
                                        : 'bg-gray-200 dark:bg-gray-700 group-hover:bg-gray-300 dark:group-hover:bg-gray-600'
                                    }`}>
                                      <span className="text-gray-600 dark:text-gray-300 text-lg font-bold">∅</span>
                            </div>
                                    <div className="flex-1">
                                      <div className="flex items-center justify-between">
                            <div>
                                          <div className="font-bold text-lg text-gray-900 dark:text-white">
                                            Vote blanc
                                          </div>
                                          <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                                Je ne souhaite pas voter pour ce poste
                                          </div>
                                        </div>
                                        {votes[position.id] === "blanc" && (
                                          <CheckCircle className="h-6 w-6 text-green-600" />
                                        )}
                              </div>
                            </div>
                          </div>
                      </div>
                              </div>
                              <Label htmlFor={`blanc-${position.id}`} className="absolute inset-0 cursor-pointer" />
                            </div>

                            {/* Candidats */}
                            {position.candidacies?.map((candidacy) => (
                              <div key={candidacy.id} className={`group relative overflow-hidden rounded-xl border-2 transition-all duration-300 ${
                                candidacy.status === "Validee" ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'
                              } ${
                                votes[position.id] === candidacy.id 
                                  ? 'border-blue-400 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 shadow-lg' 
                                  : candidacy.status === "Validee"
                                    ? 'border-gray-200 hover:border-blue-300 hover:shadow-md bg-white dark:bg-slate-600'
                                    : 'border-gray-300 bg-gray-50 dark:bg-slate-700'
                              }`}>
                                <div className="p-4">
                                  <div className="flex items-center">
                                    {candidacy.status === "Validee" ? (
                                      <RadioGroupItem value={candidacy.id} id={candidacy.id} className="mr-4" />
                                    ) : (
                                      <div className="w-4 h-4 border-2 border-gray-300 rounded-full mr-4 flex items-center justify-center">
                                        <XCircle className="h-3 w-3 text-gray-400" />
                                      </div>
                                    )}
                                    
                                    <Avatar className="w-12 h-12 border-2 border-white dark:border-slate-800 shadow-md mr-4">
                                      <AvatarImage 
                                        src={candidacy.adherent.User.image || undefined} 
                                        alt={`${candidacy.adherent.firstname} ${candidacy.adherent.lastname}`}
                                        className="object-cover"
                                      />
                                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-sm">
                                        {getInitials(`${candidacy.adherent.firstname} ${candidacy.adherent.lastname}`)}
                                      </AvatarFallback>
                                    </Avatar>
                                    
                              <div className="flex-1">
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <div className="font-semibold text-lg text-gray-900 dark:text-white">
                                  {candidacy.adherent.firstname} {candidacy.adherent.lastname}
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-300">
                                            {candidacy.adherent.User.name}
                                </div>
                                  </div>
                                        
                                        <div className="flex items-center space-x-2">
                                          {votes[position.id] === candidacy.id && (
                                            <CheckCircle className="h-5 w-5 text-green-600" />
                                          )}
                                          {candidacy.status !== "Validee" && (
                                            <Badge className={`text-xs ${
                                              candidacy.status === "EnAttente"
                                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                            }`}>
                                              {candidacy.status === "EnAttente" ? "En attente" : "Rejeté"}
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                {candidacy.status === "Validee" && (
                                  <Label htmlFor={candidacy.id} className="absolute inset-0 cursor-pointer" />
                                )}
                        </div>
                      ))}
                    </RadioGroup>

                    {/* Indicateur de vote */}
                    {votes[position.id] && (
                            <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200 dark:border-green-700">
                              <div className="flex items-center">
                                <CheckCircle className="h-5 w-5 mr-3 text-green-600" />
                                <div>
                                  <span className="font-semibold text-green-800 dark:text-green-200">
                                    Vote enregistré avec succès
                                  </span>
                                  <div className="text-sm text-green-700 dark:text-green-300 mt-1">
                          {votes[position.id] === "blanc" 
                                      ? "Vous avez voté blanc pour ce poste" 
                                      : `Vous avez voté pour ${position.candidacies?.find(c => c.id === votes[position.id])?.adherent.firstname} ${position.candidacies?.find(c => c.id === votes[position.id])?.adherent.lastname}`
                                    }
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Résumé des votes */}
                  {isVoteComplete() && (
                    <div className="mt-10 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-700">
                      <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                          <CheckCircle className="h-8 w-8 text-white" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                          Vote complet !
                        </h3>
                        <p className="text-gray-600 dark:text-gray-300">
                          Vous avez voté pour tous les postes disponibles
                        </p>
                      </div>
                      
                      <div className="space-y-3">
                        {getVoteSummary().map((summary, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-white dark:bg-slate-700 rounded-lg">
                            <span className="font-medium text-gray-900 dark:text-white">{summary.position}</span>
                            <span className="text-sm text-gray-600 dark:text-gray-300">{summary.vote}</span>
                  </div>
                ))}
              </div>
                      
                      <div className="mt-6 text-center">
                        <Button 
                          onClick={() => setShowSummary(!showSummary)}
                          variant="outline"
                          className="mr-3"
                        >
                          {showSummary ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                          {showSummary ? 'Masquer' : 'Voir'} le résumé
                        </Button>
                      </div>
                    </div>
                  )}

              {/* Instructions */}
                  <div className="mt-10 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-700">
                <div className="flex items-start">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mr-4 flex-shrink-0">
                        <AlertCircle className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-xl font-bold text-blue-900 dark:text-blue-100 mb-4">
                      Instructions de vote
                    </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <div className="flex items-start">
                              <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                              <div>
                                <div className="font-semibold text-blue-900 dark:text-blue-100">Sélection</div>
                                <div className="text-sm text-blue-800 dark:text-blue-200">Choisissez un candidat ou votez blanc pour chaque poste</div>
                              </div>
                            </div>
                            <div className="flex items-start">
                              <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                              <div>
                                <div className="font-semibold text-blue-900 dark:text-blue-100">Enregistrement</div>
                                <div className="text-sm text-blue-800 dark:text-blue-200">Votre vote est sauvegardé immédiatement</div>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-start">
                              <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                              <div>
                                <div className="font-semibold text-blue-900 dark:text-blue-100">Unicité</div>
                                <div className="text-sm text-blue-800 dark:text-blue-200">Un seul vote par poste autorisé</div>
                              </div>
                            </div>
                            <div className="flex items-start">
                              <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                              <div>
                                <div className="font-semibold text-blue-900 dark:text-blue-100">Sécurité</div>
                                <div className="text-sm text-blue-800 dark:text-blue-200">Vote anonyme et cryptographiquement sécurisé</div>
                              </div>
                            </div>
                          </div>
                        </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

            {/* Message quand aucune élection */}
        {elections.length === 0 && (
              <Card className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-900/20 dark:to-slate-900/20 border-gray-200 dark:border-gray-800">
                <CardContent className="p-12 text-center">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Vote className="h-8 w-8 text-gray-600 dark:text-gray-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Aucune élection ouverte au vote
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
                    Il n'y a actuellement aucune élection ouverte au vote.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          /* Section Historique des votes */
          <div className="space-y-8">
            {voteHistory.length === 0 ? (
              <Card className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-900/20 dark:to-slate-900/20 border-gray-200 dark:border-gray-800">
                <CardContent className="p-12 text-center">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <History className="h-8 w-8 text-gray-600 dark:text-gray-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Aucun historique de vote
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Vous n'avez pas encore participé à des élections.
                  </p>
                </CardContent>
              </Card>
            ) : (
              voteHistory.map((election) => (
                <Card key={election.election.id} className="shadow-xl border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
                  <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mr-4">
                          <Calendar className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-xl font-bold text-gray-900 dark:text-white">
                            {election.election.titre}
                          </CardTitle>
                          <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-300 mt-1">
                            <span className="flex items-center">
                              <Clock className="h-4 w-4 mr-1" />
                              {new Date(election.election.dateOuverture).toLocaleDateString()} - {new Date(election.election.dateCloture).toLocaleDateString()}
                            </span>
                            <span className="flex items-center">
                              <Users className="h-4 w-4 mr-1" />
                              {election.positions.length} poste(s)
                            </span>
                          </div>
                        </div>
                      </div>
                      <Badge className={`${getStatusColor(election.election.status)} px-3 py-1 text-sm font-semibold`}>
                        {getStatusLabel(election.election.status)}
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="p-6">
                    <div className="space-y-6">
                      {election.positions.map((position: any) => {
                        const userVote = position.votes.find((vote: any) => vote.adherentId);
                        return (
                          <div key={position.id} className="border rounded-lg p-4 bg-gray-50 dark:bg-slate-700">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold text-gray-900 dark:text-white">
                                {POSTES_LABELS[position.type as keyof typeof POSTES_LABELS]}
                              </h4>
                              {userVote ? (
                                <div className="flex items-center text-green-600 dark:text-green-400">
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  <span className="text-sm font-medium">Voté</span>
                                </div>
                              ) : (
                                <div className="flex items-center text-gray-500 dark:text-gray-400">
                                  <XCircle className="h-4 w-4 mr-2" />
                                  <span className="text-sm">Non voté</span>
                                </div>
                              )}
                            </div>
                            
                            {userVote && (
                              <div className="bg-white dark:bg-slate-600 rounded-lg p-3">
                                <div className="flex items-center">
                                  <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center mr-3">
                                    <UserCheck className="h-4 w-4 text-white" />
                                  </div>
                                  <div>
                                    <div className="font-medium text-gray-900 dark:text-white">
                                      {userVote.status === "Blanc" 
                                        ? "Vote blanc" 
                                        : userVote.candidacy 
                                          ? `${userVote.candidacy.adherent.firstname} ${userVote.candidacy.adherent.lastname}`
                                          : "Vote enregistré"
                                      }
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-300">
                                      {userVote.status === "Blanc" 
                                        ? "Vous avez voté blanc pour ce poste" 
                                        : userVote.candidacy 
                                          ? `Vous avez voté pour ${userVote.candidacy.adherent.firstname} ${userVote.candidacy.adherent.lastname}`
                                          : "Vote enregistré"
                                      }
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
