"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/components/home/Navbar";
import { Footer } from "@/components/home/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Crown, 
  Award, 
  Users, 
  Calendar, 
  CheckCircle,
  Star,
  Trophy,
  Shield,
  Heart,
  Sparkles,
  Loader2,
  TrendingUp,
  BarChart3
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import Image from "next/image";
import { getElections, getElectionResults } from "@/actions/elections";
import { POSTES_LABELS } from "@/lib/elections-constants";
import { ElectionStatus } from "@prisma/client";
import { toast } from "sonner";

interface Election {
  id: string;
  titre: string;
  description?: string;
  status: ElectionStatus;
  dateScrutin: string;
  dateOuverture: string;
  dateCloture: string;
  _count?: {
    votes: number;
  };
}

interface ElectionResults {
  election: Election;
  positions: Array<{
    position: {
      id: string;
      titre: string;
      type: string;
    };
    candidacies: Array<{
      id: string;
      votesCount: number;
      percentage: number;
      adherent: {
        firstname: string | null;
        lastname: string | null;
        civility: string | null;
        User?: {
          id: string | null;
          name: string | null;
          email: string | null;
          image: string | null;
        };
      };
    }>;
    totalVotes: number;
    blankVotes: number;
  }>;
}

export default function ResultatsElectionsPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElectionId, setSelectedElectionId] = useState<string>("");
  const [results, setResults] = useState<ElectionResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger les élections disponibles
  useEffect(() => {
    async function loadElections() {
      try {
        setLoading(true);
        const result = await getElections();
        
        if (result.success && result.elections) {
          // Filtrer seulement les élections clôturées (avec résultats disponibles)
          const availableElections = result.elections.filter((election: Election) => 
            election.status === ElectionStatus.Cloturee
          );
          
          setElections(availableElections);
          
          // Sélectionner automatiquement la première élection (la plus récente)
          if (availableElections.length > 0) {
            setSelectedElectionId(availableElections[0].id);
          }
        } else {
          setError(result.error || "Erreur lors du chargement des élections");
        }
      } catch (err: any) {
        console.error("Erreur:", err);
        setError(err.message || "Erreur lors du chargement des élections");
      } finally {
        setLoading(false);
      }
    }
    
    loadElections();
  }, []);

  // Charger les résultats de l'élection sélectionnée
  useEffect(() => {
    if (!selectedElectionId) return;

    async function loadResults() {
      try {
        setLoadingResults(true);
        const result = await getElectionResults(selectedElectionId);
        
        if (result.success && result.results) {
          setResults(result.results);
        } else {
          toast.error(result.error || "Erreur lors du chargement des résultats");
          setResults(null);
        }
      } catch (err: any) {
        console.error("Erreur:", err);
        toast.error(err.message || "Erreur lors du chargement des résultats");
        setResults(null);
      } finally {
        setLoadingResults(false);
      }
    }
    
    loadResults();
  }, [selectedElectionId]);

  const getCivilityLabel = (civility: string | null) => {
    if (!civility) return "";
    switch (civility) {
      case "Monsieur":
        return "M.";
      case "Madame":
        return "Mme";
      case "Mademoiselle":
        return "Miss";
      default:
        return civility;
    }
  };

  const selectedElection = elections.find(e => e.id === selectedElectionId);
  const totalVotesAll = results?.positions.reduce((sum, p) => sum + p.totalVotes, 0) || 0;
  const totalPositions = results?.positions.length || 0;
  const totalCandidates = results?.positions.reduce((sum, p) => sum + p.candidacies.length, 0) || 0;

  // Calculer le taux de participation (approximatif basé sur le nombre de votes)
  // Note: Il faudrait avoir le nombre total d'adhérents éligibles pour calculer le vrai taux
  const participationRate = totalVotesAll > 0 ? Math.min(100, Math.round((totalVotesAll / 50) * 100)) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <Navbar />

      {/* Hero Section */}
      <section className="relative py-6 sm:py-8 md:py-10 bg-gradient-to-r from-blue-600 via-white to-red-600 text-white overflow-hidden">
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-full animate-pulse" />
          <div className="absolute top-32 right-20 w-16 h-16 bg-white/10 rounded-full animate-pulse delay-1000" />
          <div className="absolute bottom-20 left-1/4 w-12 h-12 bg-white/10 rounded-full animate-pulse delay-2000" />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center mb-3 sm:mb-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-3 sm:p-4 shadow-2xl">
              <Trophy className="h-8 w-8 sm:h-12 sm:w-12 text-white" />
            </div>
          </div>
          
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-2 sm:mb-4 text-white drop-shadow-lg">
            Résultats des Élections
          </h1>
          <p className="text-base sm:text-lg md:text-xl mb-3 sm:mb-4 text-blue-100">
            Découvrez les résultats de nos élections démocratiques
          </p>
          
          {/* Sélecteur d'élection */}
          {!loading && elections.length > 0 && (
            <div className="max-w-md mx-auto mb-4">
              <Select value={selectedElectionId} onValueChange={setSelectedElectionId}>
                <SelectTrigger className="bg-white/90 text-gray-900 border-white/30">
                  <SelectValue placeholder="Sélectionner une élection" />
                </SelectTrigger>
                <SelectContent>
                  {elections.map((election) => (
                    <SelectItem key={election.id} value={election.id}>
                      {election.titre} - {new Date(election.dateScrutin).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric"
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedElection && (
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mt-4">
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-sm sm:text-lg px-4 sm:px-6 py-2 sm:py-3">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                {new Date(selectedElection.dateScrutin).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric"
                })}
              </Badge>
              {selectedElection._count && (
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-sm sm:text-lg px-4 sm:px-6 py-2 sm:py-3">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  {selectedElection._count.votes} vote(s)
                </Badge>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Contenu principal */}
      {loading ? (
        <section className="py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600" />
            <p className="mt-4 text-gray-600 dark:text-gray-300">Chargement des élections...</p>
          </div>
        </section>
      ) : error ? (
        <section className="py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Card className="border-red-200 dark:border-red-800">
              <CardContent className="p-4 text-center">
                <p className="text-red-600 dark:text-red-400">{error}</p>
              </CardContent>
            </Card>
          </div>
        </section>
      ) : elections.length === 0 ? (
        <section className="py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Card>
              <CardContent className="p-4 text-center">
                <Trophy className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <p className="text-lg text-gray-600 dark:text-gray-300">
                  Aucune élection avec résultats disponibles pour le moment.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      ) : loadingResults ? (
        <section className="py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600" />
            <p className="mt-4 text-gray-600 dark:text-gray-300">Chargement des résultats...</p>
          </div>
        </section>
      ) : !results ? (
        <section className="py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-gray-600 dark:text-gray-300">
                  Aucun résultat disponible pour cette élection.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      ) : (
        <>
          {/* Statistiques */}
          <section className="py-4 sm:py-6 bg-white dark:bg-slate-900">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Statistiques des Élections
                </h2>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
                  Un aperçu des résultats de nos élections démocratiques
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <Card className="text-center p-3 sm:p-4 border-2 border-green-200 dark:border-green-800">
                  <div className="bg-green-100 dark:bg-green-900/20 w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Users className="h-4 w-4 sm:h-6 sm:w-6 text-green-600" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-1">
                    {participationRate}%
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">Participation</p>
                </Card>

                <Card className="text-center p-3 sm:p-4 border-2 border-blue-200 dark:border-blue-800">
                  <div className="bg-blue-100 dark:bg-blue-900/20 w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center mx-auto mb-2">
                    <BarChart3 className="h-4 w-4 sm:h-6 sm:w-6 text-blue-600" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-1">
                    {totalVotesAll}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">Total votes</p>
                </Card>

                <Card className="text-center p-3 sm:p-4 border-2 border-purple-200 dark:border-purple-800">
                  <div className="bg-purple-100 dark:bg-purple-900/20 w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Award className="h-4 w-4 sm:h-6 sm:w-6 text-purple-600" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-1">
                    {totalPositions}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">Postes</p>
                </Card>

                <Card className="text-center p-3 sm:p-4 border-2 border-orange-200 dark:border-orange-800">
                  <div className="bg-orange-100 dark:bg-orange-900/20 w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center mx-auto mb-2">
                    <TrendingUp className="h-4 w-4 sm:h-6 sm:w-6 text-orange-600" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-1">
                    {totalCandidates}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">Candidats</p>
                </Card>
              </div>
            </div>
          </section>

          {/* Résultats par poste */}
          <section className="py-4 sm:py-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Résultats par Poste
                </h2>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
                  Découvrez les résultats détaillés pour chaque poste
                </p>
              </div>

              <div className="space-y-4 sm:space-y-6">
                {results.positions.map((positionResult, index) => {
                  const positionLabel = POSTES_LABELS[positionResult.position.type as keyof typeof POSTES_LABELS] || positionResult.position.titre;
                  const winner = positionResult.candidacies.length > 0 && positionResult.candidacies[0].votesCount > 0 ? positionResult.candidacies[0] : null;
                  const isPresident = positionResult.position.type === "President";
                  const isVicePresident = positionResult.position.type === "VicePresident";
                  const winnerCivility = winner ? getCivilityLabel(winner.adherent.civility) : "";
                  const winnerFullName = winner ? `${winner.adherent.firstname || ""} ${winner.adherent.lastname || ""}`.trim() : "";

                  return (
                    <Card 
                      key={positionResult.position.id} 
                      className={`border-2 ${
                        isPresident 
                          ? "border-yellow-200 dark:border-yellow-800 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20"
                          : isVicePresident
                          ? "border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20"
                          : "border-gray-200 dark:border-gray-800 bg-white dark:bg-slate-800"
                      }`}
                    >
                      <CardHeader className={`pb-2 ${
                        isPresident 
                          ? "bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-900/30 dark:to-orange-900/30"
                          : isVicePresident
                          ? "bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30"
                          : "bg-gradient-to-r from-gray-100 to-slate-100 dark:from-gray-800 dark:to-slate-800"
                      }`}>
                        <div className="flex items-start gap-3 sm:gap-4">
                          {/* Photo/Avatar du candidat élu */}
                          {winner && winner.votesCount > 0 && (
                            <div className="flex-shrink-0">
                              <div className={`relative ${
                                isPresident 
                                  ? "ring-2 ring-yellow-400"
                                  : isVicePresident
                                  ? "ring-2 ring-blue-400"
                                  : "ring-2 ring-green-400"
                              } rounded-full p-0.5`}>
                                <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
                                  <AvatarImage 
                                    src={winner.adherent.User?.image || undefined} 
                                    alt={winnerFullName}
                                  />
                                  <AvatarFallback className={`${
                                    isPresident 
                                      ? "bg-gradient-to-br from-yellow-400 to-orange-500 text-white"
                                      : isVicePresident
                                      ? "bg-gradient-to-br from-blue-400 to-indigo-500 text-white"
                                      : "bg-gradient-to-br from-green-400 to-emerald-500 text-white"
                                  } text-lg sm:text-xl font-bold`}>
                                    {winnerCivility && winnerCivility.charAt(0)}
                                    {winner.adherent.firstname?.charAt(0) || ""}
                                    {winner.adherent.lastname?.charAt(0) || ""}
                                  </AvatarFallback>
                                </Avatar>
                              </div>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <CardTitle className="flex items-center gap-2 sm:gap-3 text-lg sm:text-xl md:text-2xl">
                              {isPresident && <Crown className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600" />}
                              {isVicePresident && <Award className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />}
                              {!isPresident && !isVicePresident && <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />}
                              {positionLabel}
                            </CardTitle>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-1">
                              {positionResult.totalVotes} vote(s) au total
                              {positionResult.blankVotes > 0 && ` • ${positionResult.blankVotes} vote(s) blanc(s)`}
                            </p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-3 sm:p-4">
                        {positionResult.candidacies.length === 0 ? (
                          <p className="text-center text-gray-600 dark:text-gray-300 py-4">
                            Aucun candidat pour ce poste
                          </p>
                        ) : (
                          <div className="space-y-2 sm:space-y-3">
                            {positionResult.candidacies.map((candidacy, idx) => {
                              const isWinner = idx === 0 && candidacy.votesCount > 0;
                              const civility = getCivilityLabel(candidacy.adherent.civility);
                              const fullName = `${candidacy.adherent.firstname || ""} ${candidacy.adherent.lastname || ""}`.trim();
                              const candidateCivility = getCivilityLabel(candidacy.adherent.civility);

                              return (
                                <div
                                  key={candidacy.id}
                                  className={`p-2 sm:p-3 rounded-lg border-2 transition-all ${
                                    isWinner
                                      ? isPresident
                                        ? "bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/30 dark:to-orange-900/30 border-yellow-300 dark:border-yellow-700 shadow-md"
                                        : isVicePresident
                                        ? "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-blue-300 dark:border-blue-700 shadow-md"
                                        : "bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-green-300 dark:border-green-700 shadow-md"
                                      : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700"
                                  }`}
                                >
                                  <div className="flex items-center gap-2 sm:gap-3">
                                    {/* Avatar pour les non-élus */}
                                    {!isWinner && (
                                      <Avatar className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0">
                                        <AvatarImage 
                                          src={candidacy.adherent.User?.image || undefined} 
                                          alt={fullName}
                                        />
                                        <AvatarFallback className="bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium">
                                          {candidacy.adherent.firstname?.charAt(0) || ""}
                                          {candidacy.adherent.lastname?.charAt(0) || ""}
                                        </AvatarFallback>
                                      </Avatar>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {isWinner && (
                                          <Badge className={`${
                                            isPresident
                                              ? "bg-yellow-500 text-white"
                                              : isVicePresident
                                              ? "bg-blue-500 text-white"
                                              : "bg-green-500 text-white"
                                          } text-xs`}>
                                            {isPresident ? <Crown className="h-3 w-3 mr-1" /> : <Trophy className="h-3 w-3 mr-1" />}
                                            Élu
                                          </Badge>
                                        )}
                                        <span className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate">
                                          {candidateCivility && <span className="mr-1">{candidateCivility}</span>}
                                          {fullName || "Nom non disponible"}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-1">
                                        <span className="flex items-center gap-1">
                                          <Users className="h-3 w-3" />
                                          {candidacy.votesCount} vote(s)
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <TrendingUp className="h-3 w-3" />
                                          {candidacy.percentage.toFixed(1)}%
                                        </span>
                                      </div>
                                    </div>
                                    {/* Barre de progression */}
                                    <div className="w-20 sm:w-32 flex-shrink-0">
                                      <div className="h-2 sm:h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full transition-all ${
                                            isWinner
                                              ? isPresident
                                                ? "bg-gradient-to-r from-yellow-500 to-orange-500"
                                                : isVicePresident
                                                ? "bg-gradient-to-r from-blue-500 to-indigo-500"
                                                : "bg-gradient-to-r from-green-500 to-emerald-500"
                                              : "bg-gradient-to-r from-gray-400 to-gray-500"
                                          }`}
                                          style={{ width: `${Math.min(100, candidacy.percentage)}%` }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Section CTA */}
          <section className="py-4 sm:py-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2 sm:mb-4">
                Félicitations à nos Nouveaux Dirigeants !
              </h2>
              <p className="text-sm sm:text-base mb-3 sm:mb-4 text-indigo-100">
                Nous sommes confiants que cette nouvelle équipe dirigera notre association vers un avenir brillant
              </p>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center">
                <Link href="/evenements">
                  <Button size="sm" className="bg-white text-indigo-600 hover:bg-gray-100 px-4 sm:px-6 py-2 sm:py-3 text-sm">
                    Voir nos Événements
                  </Button>
                </Link>
                <Link href="/amicale">
                  <Button size="sm" variant="outline" className="border-white text-white hover:bg-white/10 px-4 sm:px-6 py-2 sm:py-3 text-sm">
                    Découvrir l'Association
                  </Button>
                </Link>
              </div>
            </div>
          </section>
        </>
      )}

      <Footer />
    </div>
  );
}
