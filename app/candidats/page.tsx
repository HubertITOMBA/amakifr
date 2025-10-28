"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Users, 
  Calendar, 
  Clock, 
  FileText, 
  Award, 
  UserCheck,
  Eye,
  Mail,
  Phone,
  MapPin,
  GraduationCap
} from "lucide-react";
import { getAllCandidates } from "@/actions/elections";
import { POSTES_LABELS } from "@/lib/elections-constants";
import { ElectionStatus, CandidacyStatus } from "@prisma/client";
import Link from "next/link";

interface Candidate {
  adherent: {
    id: string;
    User: {
      id: string;
      name: string;
      email: string;
      image: string | null;
    };
    telephone?: string;
    adresse?: {
      ville?: string;
      pays?: string;
    };
  };
  election: {
    id: string;
    titre: string;
    status: ElectionStatus;
    dateOuverture: Date;
    dateCloture: Date;
  };
  positions: Array<{
    id: string;
    type: string;
    titre?: string;
  }>;
  motivation: string;
  programme: string;
  status: CandidacyStatus;
  createdAt: Date;
}

export default function CandidatsPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCandidates();
  }, []);

  const loadCandidates = async () => {
    try {
      setLoading(true);
      const result = await getAllCandidates();
      
      if (result.success && result.candidates) {
        setCandidates(result.candidates);
      } else {
        setError(result.error || "Erreur lors du chargement des candidats");
      }
    } catch (error) {
      console.error("Erreur lors du chargement:", error);
      setError("Erreur lors du chargement des candidats");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: CandidacyStatus) => {
    switch (status) {
      case CandidacyStatus.EnAttente:
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case CandidacyStatus.Validee:
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case CandidacyStatus.Rejetee:
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getStatusLabel = (status: CandidacyStatus) => {
    switch (status) {
      case CandidacyStatus.EnAttente:
        return "En attente";
      case CandidacyStatus.Validee:
        return "Validée";
      case CandidacyStatus.Rejetee:
        return "Rejetée";
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="container mx-auto px-4 py-6 lg:py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <Users className="h-8 w-8 text-white" />
              </div>
              <p className="text-lg text-gray-600 dark:text-gray-300">Chargement des candidats...</p>
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
              <Users className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Erreur</h2>
            <p className="text-gray-600 dark:text-gray-300">{error}</p>
            <Button 
              onClick={loadCandidates}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
            >
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
            <Users className="h-8 w-8 lg:h-10 lg:w-10 text-white" />
          </div>
          <h1 className="text-3xl lg:text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Candidats aux Élections
          </h1>
          <p className="text-base lg:text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed mt-4">
            Découvrez les candidats qui se présentent aux élections. 
            Consultez leurs motivations et programmes pour faire votre choix.
          </p>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-2xl font-bold text-blue-900 dark:text-blue-100">{candidates.length}</h3>
              <p className="text-blue-700 dark:text-blue-300">Candidats</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <Award className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-2xl font-bold text-green-900 dark:text-green-100">
                {candidates.reduce((total, candidate) => total + candidate.positions.length, 0)}
              </h3>
              <p className="text-green-700 dark:text-green-300">Postes candidatés</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-800">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <Calendar className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                {new Set(candidates.map(c => c.election.id)).size}
              </h3>
              <p className="text-purple-700 dark:text-purple-300">Élections</p>
            </CardContent>
          </Card>
        </div>

        {/* Liste des candidats groupés par élections */}
        {candidates.length === 0 ? (
          <Card className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-900/20 dark:to-slate-900/20 border-gray-200 dark:border-gray-800">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-gray-600 dark:text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Aucun candidat trouvé
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Il n'y a actuellement aucun candidat aux élections.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {(() => {
              // Grouper les candidats par élection
              const candidatesByElection = candidates.reduce((acc: any, candidate: any) => {
                const electionId = candidate.election.id;
                if (!acc[electionId]) {
                  acc[electionId] = {
                    election: candidate.election,
                    candidates: []
                  };
                }
                acc[electionId].candidates.push(candidate);
                return acc;
              }, {});

              return Object.values(candidatesByElection).map((group: any) => (
                <div key={group.election.id} className="space-y-6">
                  {/* En-tête de l'élection */}
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mb-3 shadow-lg">
                      <Calendar className="h-6 w-6 text-white" />
                    </div>
                    <h2 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                      {group.election.titre}
                    </h2>
                    <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                      <span className="flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-blue-500" />
                        <span className="font-medium">Ouverture:</span>
                        <span className="ml-1">{new Date(group.election.dateOuverture).toLocaleDateString()}</span>
                      </span>
                      <span className="flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-orange-500" />
                        <span className="font-medium">Clôture:</span>
                        <span className="ml-1">{new Date(group.election.dateCloture).toLocaleDateString()}</span>
                      </span>
                      <span className="flex items-center">
                        <Users className="h-4 w-4 mr-2 text-green-500" />
                        <span className="font-medium">{group.candidates.length} candidat(s)</span>
                      </span>
                      <Badge className="bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 dark:from-blue-900 dark:to-indigo-900 dark:text-blue-200 px-3 py-1 text-sm font-semibold">
                        {group.election.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Grille des candidats pour cette élection */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {group.candidates.map((candidate: any) => (
                      <Card key={`${candidate.adherent.id}-${candidate.election.id}`} className="shadow-xl border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
                        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-b border-green-200 dark:border-green-800">
                          <div className="flex items-center space-x-4">
                            <Avatar className="w-16 h-16 border-4 border-white dark:border-slate-800 shadow-lg">
                              <AvatarImage 
                                src={candidate.adherent.User.image || undefined} 
                                alt={`${candidate.adherent.firstname} ${candidate.adherent.lastname}`}
                                className="object-cover"
                              />
                              <AvatarFallback className="bg-gradient-to-br from-green-500 to-emerald-600 text-white font-bold text-lg">
                                {getInitials(`${candidate.adherent.firstname} ${candidate.adherent.lastname}`)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-lg font-bold text-gray-900 dark:text-white truncate">
                                {candidate.adherent.civility && (
                                  <span className="text-sm font-normal text-gray-500 dark:text-gray-400 mr-2">
                                    {candidate.adherent.civility === 'Monsieur' ? 'M.' : 
                                     candidate.adherent.civility === 'Madame' ? 'Mme' : 
                                     candidate.adherent.civility === 'Mademoiselle' ? 'Mlle' : 
                                     candidate.adherent.civility}
                                  </span>
                                )}
                                {candidate.adherent.firstname} {candidate.adherent.lastname}
                              </CardTitle>
                              <CardDescription className="text-sm text-gray-600 dark:text-gray-300">
                                <div className="space-y-2">
                                  {/* Email */}
                                  <div className="flex items-center">
                                    <svg className="h-3 w-3 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    <span className="text-xs">{candidate.adherent.User.email}</span>
                                  </div>
                                  
                                  {/* Téléphones */}
                                  {candidate.adherent.Telephones && candidate.adherent.Telephones.length > 0 ? (
                                    candidate.adherent.Telephones.map((phone: any) => (
                                      <div key={phone.id} className="flex items-center">
                                        <Phone className="h-3 w-3 mr-2 text-gray-500" />
                                        <span className="text-xs">
                                          {phone.numero}
                                          {phone.type && (
                                            <span className="ml-1 text-gray-400">
                                              ({phone.type === 'Mobile' ? 'Mobile' : 
                                                phone.type === 'Fixe' ? 'Fixe' : 
                                                phone.type === 'Travail' ? 'Travail' : 
                                                phone.type})
                                            </span>
                                          )}
                                        </span>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="flex items-center">
                                      <Phone className="h-3 w-3 mr-2 text-gray-500" />
                                      <span className="text-xs text-gray-400 italic">Aucun téléphone renseigné</span>
                                    </div>
                                  )}
                                </div>
                              </CardDescription>
                              <Badge className={`mt-2 ${getStatusColor(candidate.status)} text-xs font-semibold`}>
                                {getStatusLabel(candidate.status)}
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                        
                        <CardContent className="p-6">
                          {/* Postes candidatés */}
                          <div className="mb-6">
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                              <Award className="h-4 w-4 mr-2 text-green-500" />
                              Postes candidatés ({candidate.positions.length})
                            </h4>
                            <div className="space-y-2">
                              {candidate.positions.map((position: any) => (
                                <div key={position.id} className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 border border-green-200 dark:border-green-800">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-green-900 dark:text-green-100">
                                      {POSTES_LABELS[position.type as keyof typeof POSTES_LABELS]}
                                    </span>
                                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">
                                      Poste
                                    </Badge>
                                  </div>
                                  {/* {position.titre && (
                                    <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                                      {position.titre}
                                    </p>
                                  )} */}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Informations de contact */}
                          {(candidate.adherent.telephone || candidate.adherent.adresse) && (
                            <div className="mb-6">
                              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                                <UserCheck className="h-4 w-4 mr-2 text-purple-500" />
                                Contact
                              </h4>
                              <div className="space-y-2">
                                {candidate.adherent.telephone && (
                                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                    <Phone className="h-3 w-3 mr-2 text-purple-500" />
                                    {candidate.adherent.telephone}
                                  </div>
                                )}
                                {candidate.adherent.adresse && (
                                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                    <MapPin className="h-3 w-3 mr-2 text-purple-500" />
                                    {candidate.adherent.adresse.ville}, {candidate.adherent.adresse.pays}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Bouton pour voir la candidature */}
                          <div className="space-y-3">
                            <Link href={`/candidatures?election=${candidate.election.id}&candidate=${candidate.adherent.id}`} className="block">
                              <Button className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg transform hover:scale-105 transition-all duration-200">
                                <Eye className="h-4 w-4 mr-2" />
                                Voir la candidature
                              </Button>
                            </Link>
                            
                            <div className="text-center">
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Candidature du {new Date(candidate.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
