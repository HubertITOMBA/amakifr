"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  UserPlus, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  FileText,
  Vote,
  Users,
  Calendar,
  AlertCircle
} from "lucide-react";
import { 
  getElections,
  createCandidacy,
  createMultipleCandidacies,
  getUserCandidacies,
  updateCandidacy,
  updateCandidacyPositions
} from "@/actions/elections";
import { getUserData } from "@/actions/user";
import { POSTES_LABELS } from "@/lib/elections-constants";
import { ElectionStatus, PositionType, CandidacyStatus } from "@prisma/client";

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
  status: CandidacyStatus;
  motivation?: string;
  programme?: string;
  adherent: {
    firstname: string;
    lastname: string;
    User: {
      name: string;
      email: string;
    };
  };
}

export default function CandidaturesPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedElection, setSelectedElection] = useState<string>("");
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [showCandidacyForm, setShowCandidacyForm] = useState(false);
  const [isAdherent, setIsAdherent] = useState<boolean | null>(null);
  const [userCandidacies, setUserCandidacies] = useState<any[] | null>(null);
  const [editingCandidacy, setEditingCandidacy] = useState<string | null>(null);

  // Formulaire de candidature
  const [candidacyForm, setCandidacyForm] = useState({
    motivation: "",
    programme: ""
  });

  // Formulaire d'édition
  const [editForm, setEditForm] = useState({
    motivation: "",
    programme: "",
    selectedPositionIds: [] as string[]
  });

  useEffect(() => {
    checkAdherentStatus();
    loadUserCandidacies();
  }, []);

  // Charger les élections après avoir chargé les candidatures utilisateur
  useEffect(() => {
    // Charger les élections une fois que userCandidacies est initialisé (même si vide)
    if (userCandidacies !== null) {
      loadElections();
    }
  }, [userCandidacies]);

  const loadUserCandidacies = async () => {
    try {
      const result = await getUserCandidacies();
      if (result.success && result.candidacies) {
        setUserCandidacies(result.candidacies);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des candidatures:", error);
    }
  };

  const checkAdherentStatus = async () => {
    try {
      const result = await getUserData();
      if (result.success && result.user) {
        setIsAdherent(!!result.user.adherent);
      } else {
        setIsAdherent(false);
      }
    } catch (error) {
      console.error("Erreur lors de la vérification du statut adhérent:", error);
      setIsAdherent(false);
    }
  };

  const loadElections = async () => {
    try {
      setLoading(true);
      const result = await getElections();
      console.log("Résultat getElections:", result);
      
      if (result && result.success && result.elections && Array.isArray(result.elections)) {
        console.log("Toutes les élections:", result.elections);
        
        // Filtrer seulement les élections où l'utilisateur a des candidatures
        const electionsWithUserCandidacies = result.elections.filter((election: Election) => {
          if (!election || election.status !== ElectionStatus.Ouverte) return false;
          
          // Si userCandidacies est null ou vide, ne pas filtrer (afficher toutes les élections ouvertes)
          if (!userCandidacies || userCandidacies.length === 0) {
            return true;
          }
          
          // Vérifier si l'utilisateur a des candidatures dans cette élection
          return election.positions.some(position => 
            position.candidacies && position.candidacies.some(candidacy => 
              userCandidacies.some(uc => uc.position.election.id === election.id)
            )
          );
        });
        
        console.log("Élections avec candidatures utilisateur:", electionsWithUserCandidacies);
        setElections(electionsWithUserCandidacies || []);
        
        // Si aucune élection avec candidatures utilisateur, afficher un message
        if (electionsWithUserCandidacies && electionsWithUserCandidacies.length === 0) {
          console.log("Aucune élection avec candidatures utilisateur trouvée");
        }
      } else {
        console.error("Erreur lors du chargement:", result?.error || "Données invalides");
        setElections([]);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des élections:", error);
      setElections([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitCandidacy = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedElection || selectedPositions.length === 0) {
      alert("Veuillez sélectionner une élection et au moins un poste");
      return;
    }

    if (!candidacyForm.motivation.trim()) {
      alert("Veuillez remplir votre motivation");
      return;
    }

    if (!candidacyForm.programme.trim()) {
      alert("Veuillez remplir votre programme");
      return;
    }

    try {
      console.log("Soumission de candidature:", {
        electionId: selectedElection,
        positionIds: selectedPositions,
        motivation: candidacyForm.motivation,
        programme: candidacyForm.programme
      });

      const result = await createMultipleCandidacies(
        selectedElection,
        selectedPositions,
        candidacyForm.motivation,
        candidacyForm.programme
      );

      console.log("Résultat de la candidature:", result);

      if (result.success) {
        alert(`Candidature soumise avec succès pour ${selectedPositions.length} poste(s) !`);
        setCandidacyForm({ motivation: "", programme: "" });
        setSelectedElection("");
        setSelectedPositions([]);
        setShowCandidacyForm(false);
        await loadElections();
      } else {
        alert(`Erreur: ${result.error}`);
      }
    } catch (error) {
      console.error("Erreur lors de la soumission:", error);
      alert("Erreur lors de la soumission de la candidature");
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
      case CandidacyStatus.Retiree:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
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
      case CandidacyStatus.Retiree:
        return "Retirée";
      default:
        return status;
    }
  };

  const selectedElectionData = elections?.find(e => e && e.id === selectedElection);
  const availablePositions = selectedElectionData?.positions || [];
  
  console.log("Élection sélectionnée:", selectedElection);
  console.log("Données de l'élection sélectionnée:", selectedElectionData);
  console.log("Postes disponibles:", availablePositions);
  console.log("Postes sélectionnés:", selectedPositions);

  // Fonctions pour gérer la sélection multiple de postes
  const togglePosition = (positionId: string) => {
    setSelectedPositions(prev => {
      if (prev.includes(positionId)) {
        return prev.filter(id => id !== positionId);
      } else {
        return [...prev, positionId];
      }
    });
  };

  const selectAllPositions = () => {
    if (availablePositions && availablePositions.length > 0) {
      setSelectedPositions(availablePositions.map(p => p.id));
    }
  };

  const deselectAllPositions = () => {
    setSelectedPositions([]);
  };

  // Fonctions pour gérer l'édition des candidatures
  const startEditingCandidacy = (candidacy: any) => {
    // Vérifier que les données nécessaires sont disponibles
    if (!candidacy || !candidacy.position || !candidacy.position.election) {
      console.error("Données de candidature incomplètes:", candidacy);
      alert("Erreur: Données de candidature incomplètes");
      return;
    }

    // Récupérer tous les postes de l'adhérent pour cette élection
    const userCandidaciesForElection = userCandidacies?.filter(uc => 
      uc.position.election.id === candidacy.position.election.id
    ) || [];
    const currentPositionIds = userCandidaciesForElection.map(uc => uc.positionId);

    setEditingCandidacy(candidacy.id);
    setEditForm({
      motivation: candidacy.motivation || "",
      programme: candidacy.programme || "",
      selectedPositionIds: currentPositionIds
    });
  };

  const cancelEditing = () => {
    setEditingCandidacy(null);
    setEditForm({ motivation: "", programme: "", selectedPositionIds: [] });
  };

  const handleUpdateCandidacy = async (candidacyId: string) => {
    if (!editForm.motivation.trim()) {
      alert("Veuillez remplir votre motivation");
      return;
    }

    if (!editForm.programme.trim()) {
      alert("Veuillez remplir votre programme");
      return;
    }

    if (editForm.selectedPositionIds.length === 0) {
      alert("Veuillez sélectionner au moins un poste");
      return;
    }

    try {
      const result = await updateCandidacyPositions(
        candidacyId,
        editForm.motivation,
        editForm.programme,
        editForm.selectedPositionIds
      );

      if (result.success) {
        alert(`Candidature mise à jour avec succès pour ${editForm.selectedPositionIds.length} poste(s) !`);
        setEditingCandidacy(null);
        setEditForm({ motivation: "", programme: "", selectedPositionIds: [] });
        await loadUserCandidacies();
      } else {
        alert(`Erreur: ${result.error}`);
      }
    } catch (error) {
      console.error("Erreur lors de la mise à jour:", error);
      alert("Erreur lors de la mise à jour de la candidature");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Chargement des élections...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container mx-auto px-4 py-6 lg:py-8">
        {/* En-tête amélioré */}
        <div className="text-center mb-8 lg:mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 lg:w-20 lg:h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mb-4 lg:mb-6 shadow-lg transform hover:scale-105 transition-transform duration-300">
            <UserPlus className="h-8 w-8 lg:h-10 lg:w-10 text-white" />
          </div>
          <h1 className="text-3xl lg:text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Candidatures
          </h1>
          <p className="text-base lg:text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
            Gérez vos candidatures aux élections et postulez pour les postes qui vous intéressent. 
            Une interface intuitive pour suivre et modifier vos candidatures en toute simplicité.
          </p>
        </div>

        {/* Message si l'utilisateur n'est pas adhérent */}
        {isAdherent === false && (
          <div className="mb-8 p-6 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 rounded-xl border border-red-200 dark:border-red-800 shadow-lg">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
                  Adhésion requise
                </h3>
                <p className="text-red-700 dark:text-red-300 mb-4 leading-relaxed">
                  Vous devez être adhérent pour pouvoir postuler aux élections. 
                  Veuillez compléter votre profil adhérent depuis votre espace personnel.
                </p>
                <Button 
                  onClick={() => window.location.href = '/user/profile'}
                  className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  Compléter mon profil adhérent
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Message si aucune élection avec candidatures utilisateur */}
        {elections && elections.length === 0 && !loading && isAdherent !== false && (!userCandidacies || userCandidacies.length === 0) && (
          <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800 shadow-lg">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">
                  Aucune candidature
                </h3>
                <p className="text-blue-700 dark:text-blue-300 leading-relaxed">
                  Vous n'avez pas encore de candidatures. 
                  Consultez la section "Nouvelle candidature" pour postuler à des élections ouvertes.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Bouton de candidature amélioré */}
        {elections && elections.length > 0 && isAdherent === true && (
          <div className="mb-8 text-center">
            <Button 
              onClick={() => setShowCandidacyForm(!showCandidacyForm)}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-3 text-lg font-semibold shadow-lg transform hover:scale-105 transition-all duration-200 rounded-xl"
            >
              <UserPlus className="h-5 w-5 mr-2" />
              {showCandidacyForm ? 'Annuler la candidature' : 'Nouvelle candidature'}
            </Button>
          </div>
        )}

        {/* Formulaire de candidature amélioré */}
        {showCandidacyForm && isAdherent === true && (
          <Card className="mb-8 shadow-xl border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-t-lg">
              <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mr-3">
                  <UserPlus className="h-4 w-4 text-white" />
                </div>
                Déposer une candidature
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-300 mt-2">
                Sélectionnez l'élection et le poste pour lequel vous souhaitez candidater
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <form onSubmit={handleSubmitCandidacy} className="space-y-8">
                {/* Sélection élection */}
                <div className="space-y-3">
                  <Label htmlFor="election" className="text-base font-semibold text-gray-900 dark:text-white">
                    Élection
                  </Label>
                  <Select value={selectedElection} onValueChange={setSelectedElection}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez une élection" />
                    </SelectTrigger>
                    <SelectContent>
                      {elections && elections.map((election) => (
                        election && (
                          <SelectItem key={election.id} value={election.id}>
                            {election.titre}
                          </SelectItem>
                        )
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Sélection multiple de postes */}
                {selectedElection && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Label htmlFor="positions">Postes (vous pouvez en sélectionner plusieurs)</Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={selectAllPositions}
                          disabled={!availablePositions || availablePositions.length === 0}
                        >
                          Tout sélectionner
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={deselectAllPositions}
                          disabled={selectedPositions.length === 0}
                        >
                          Tout désélectionner
                        </Button>
                      </div>
                    </div>
                    
                    {availablePositions && availablePositions.length > 0 ? (
                      <div className="space-y-3 max-h-60 overflow-y-auto border rounded-lg p-4">
                        {availablePositions.map((position) => (
                          position && (
                            <div
                              key={position.id}
                              className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                                selectedPositions.includes(position.id)
                                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                                  : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                              onClick={() => togglePosition(position.id)}
                            >
                              <input
                                type="checkbox"
                                checked={selectedPositions.includes(position.id)}
                                onChange={() => togglePosition(position.id)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 dark:text-gray-100">
                                  {POSTES_LABELS[position.type]}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  {position.titre || `Poste de ${POSTES_LABELS[position.type].toLowerCase()}`}
                                </div>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {position.candidacies?.length || 0} candidature(s)
                              </Badge>
                            </div>
                          )
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                        <div className="flex items-center">
                          <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
                          <span className="text-sm text-red-800 dark:text-red-200">
                            Aucun poste disponible pour cette élection
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {selectedPositions.length > 0 && (
                      <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 text-green-600 mr-2" />
                          <span className="text-sm text-green-800 dark:text-green-200">
                            {selectedPositions.length} poste(s) sélectionné(s)
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Motivation */}
                <div>
                  <Label htmlFor="motivation">Motivation</Label>
                  <Textarea
                    id="motivation"
                    value={candidacyForm.motivation}
                    onChange={(e) => setCandidacyForm({...candidacyForm, motivation: e.target.value})}
                    placeholder="Expliquez pourquoi vous souhaitez occuper ce poste..."
                    rows={4}
                  />
                </div>

                {/* Programme */}
                <div>
                  <Label htmlFor="programme">Programme</Label>
                  <Textarea
                    id="programme"
                    value={candidacyForm.programme}
                    onChange={(e) => setCandidacyForm({...candidacyForm, programme: e.target.value})}
                    placeholder="Décrivez votre programme et vos objectifs..."
                    rows={6}
                  />
                </div>

                {/* Boutons */}
                <div className="flex justify-end space-x-4">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => setShowCandidacyForm(false)}
                  >
                    Annuler
                  </Button>
                  <Button 
                    type="submit" 
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={selectedPositions.length === 0}
                  >
                    {selectedPositions.length > 0 
                      ? `Soumettre candidature pour ${selectedPositions.length} poste(s)`
                      : 'Soumettre la candidature'
                    }
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Mes candidatures groupées par élection */}
        {isAdherent === true && userCandidacies && userCandidacies.length > 0 && (
          <div className="mb-12">
            <div className="text-center mb-8">
              <h2 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                Mes candidatures
              </h2>
              <p className="text-gray-600 dark:text-gray-300 text-lg">
                Gérez vos candidatures existantes et modifiez-les si nécessaire
              </p>
            </div>
            <div className="space-y-8">
              {(() => {
                // Grouper les candidatures par élection
                const candidaciesByElection = (userCandidacies || []).reduce((acc: any, candidacy: any) => {
                  const electionId = candidacy.position.election.id;
                  if (!acc[electionId]) {
                    acc[electionId] = {
                      election: candidacy.position.election,
                      candidacies: []
                    };
                  }
                  acc[electionId].candidacies.push(candidacy);
                  return acc;
                }, {});

                return Object.values(candidaciesByElection).map((group: any) => (
                  <Card key={group.election.id} className="shadow-xl border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-b border-green-200 dark:border-green-800">
                      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start space-y-4 lg:space-y-0">
                        <div className="flex-1">
                          <CardTitle className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-3">
                            {group.election.titre}
                          </CardTitle>
                          <CardDescription className="space-y-2">
                            <div className="flex flex-wrap items-center gap-4 text-sm">
                              <span className="flex items-center text-gray-600 dark:text-gray-300">
                                <Calendar className="h-4 w-4 mr-2 text-blue-500" />
                                <span className="font-medium">Ouverture:</span>
                                <span className="ml-1">{new Date(group.election.dateOuverture).toLocaleDateString()}</span>
                              </span>
                              <span className="flex items-center text-gray-600 dark:text-gray-300">
                                <Clock className="h-4 w-4 mr-2 text-orange-500" />
                                <span className="font-medium">Clôture:</span>
                                <span className="ml-1">{new Date(group.election.dateCloture).toLocaleDateString()}</span>
                              </span>
                              <span className="flex items-center text-gray-600 dark:text-gray-300">
                                <Users className="h-4 w-4 mr-2 text-green-500" />
                                <span className="font-medium">{group.candidacies.length} poste(s) candidaté(s)</span>
                              </span>
                            </div>
                          </CardDescription>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Badge className="bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 dark:from-green-900 dark:to-emerald-900 dark:text-green-200 px-4 py-2 text-sm font-semibold">
                            {group.election.status}
                          </Badge>
                          {group.election.status === ElectionStatus.Ouverte && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => startEditingCandidacy(group.candidacies[0])}
                              disabled={editingCandidacy === group.candidacies[0].id}
                              className="border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/20"
                            >
                              Modifier
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-8">
                      {/* Postes candidatés */}
                      <div className="mb-8">
                        <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                          <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mr-3">
                            <FileText className="h-3 w-3 text-white" />
                          </div>
                          Postes candidatés
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {group.candidacies.map((candidacy: any) => (
                            <div key={candidacy.id} className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
                              <div className="flex items-center space-x-3">
                                <div className="flex-shrink-0">
                                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-md">
                                    <FileText className="h-5 w-5 text-white" />
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h5 className="font-semibold text-blue-900 dark:text-blue-100 text-sm truncate">
                                    {POSTES_LABELS[candidacy.position.type as keyof typeof POSTES_LABELS]}
                                  </h5>
                                  <p className="text-xs text-blue-700 dark:text-blue-300 truncate">
                                    {candidacy.position.titre || `Poste de ${POSTES_LABELS[candidacy.position.type as keyof typeof POSTES_LABELS].toLowerCase()}`}
                                  </p>
                                </div>
                                <Badge className={`${getStatusColor(candidacy.status)} text-xs font-semibold px-2 py-1`}>
                                  {getStatusLabel(candidacy.status)}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Formulaire de modification */}
                      {editingCandidacy === group.candidacies[0].id ? (
                        <div className="space-y-8 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                          <div className="space-y-3">
                            <Label htmlFor={`edit-motivation-${group.election.id}`} className="text-base font-semibold text-gray-900 dark:text-white">
                              Motivation
                            </Label>
                            <Textarea
                              id={`edit-motivation-${group.election.id}`}
                              value={editForm.motivation}
                              onChange={(e) => setEditForm({...editForm, motivation: e.target.value})}
                              placeholder="Expliquez pourquoi vous souhaitez occuper ces postes..."
                              rows={4}
                            />
                          </div>
                          
                          {/* Sélection multiple des postes avec checkboxes */}
                          <div>
                            <Label htmlFor={`edit-positions-${group.election.id}`}>Postes (vous pouvez en sélectionner plusieurs)</Label>
                            <div className="mt-2 space-y-3">
                              {group.election.positions && group.election.positions.length > 0 ? (
                                group.election.positions.map((position: any) => (
                                  position && (
                                    <div key={position.id} className="flex items-center space-x-3">
                                      <input
                                        type="checkbox"
                                        id={`position-${position.id}`}
                                        checked={editForm.selectedPositionIds.includes(position.id)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setEditForm({
                                              ...editForm,
                                              selectedPositionIds: [...editForm.selectedPositionIds, position.id]
                                            });
                                          } else {
                                            setEditForm({
                                              ...editForm,
                                              selectedPositionIds: editForm.selectedPositionIds.filter(id => id !== position.id)
                                            });
                                          }
                                        }}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                      />
                                      <Label 
                                        htmlFor={`position-${position.id}`}
                                        className={`flex-1 cursor-pointer p-3 rounded-lg border transition-all duration-200 ${
                                          editForm.selectedPositionIds.includes(position.id)
                                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 ring-2 ring-blue-200 dark:ring-blue-800'
                                            : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center space-x-3">
                                            <Badge 
                                              variant="outline" 
                                              className={`text-xs ${
                                                editForm.selectedPositionIds.includes(position.id)
                                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-300 dark:border-blue-700'
                                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                              }`}
                                            >
                                              {POSTES_LABELS[position.type as keyof typeof POSTES_LABELS]}
                                            </Badge>
                                            <span className={`font-medium ${
                                              editForm.selectedPositionIds.includes(position.id)
                                                ? 'text-blue-900 dark:text-blue-100'
                                                : 'text-gray-900 dark:text-gray-100'
                                            }`}>
                                              {position.titre || `Poste de ${POSTES_LABELS[position.type as keyof typeof POSTES_LABELS].toLowerCase()}`}
                                            </span>
                                          </div>
                                          {group.candidacies.some((c: any) => c.positionId === position.id) && (
                                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">
                                              Poste actuel
                                            </Badge>
                                          )}
                                        </div>
                                      </Label>
                                    </div>
                                  )
                                ))
                              ) : (
                                <div className="p-3 text-sm text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                  Aucun poste disponible
                                </div>
                              )}
                            </div>
                            
                            {editForm.selectedPositionIds.length > 0 && (
                              <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                <div className="flex items-center">
                                  <CheckCircle2 className="h-4 w-4 text-green-600 mr-2" />
                                  <span className="text-sm text-green-800 dark:text-green-200">
                                    {editForm.selectedPositionIds.length} poste(s) sélectionné(s)
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <div>
                            <Label htmlFor={`edit-programme-${group.election.id}`}>Programme</Label>
                            <Textarea
                              id={`edit-programme-${group.election.id}`}
                              value={editForm.programme}
                              onChange={(e) => setEditForm({...editForm, programme: e.target.value})}
                              placeholder="Décrivez votre programme et vos objectifs..."
                              rows={6}
                            />
                          </div>
                          <div className="flex justify-end space-x-2">
                            <Button variant="outline" onClick={cancelEditing}>
                              Annuler
                            </Button>
                            <Button 
                              onClick={() => handleUpdateCandidacy(group.candidacies[0].id)} 
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              Sauvegarder
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {/* Motivation et Programme affichés une seule fois */}
                          {group.candidacies[0].motivation && (
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
                              <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-4 flex items-center">
                                <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                                  <span className="text-white text-xs font-bold">M</span>
                                </div>
                                Motivation
                              </h4>
                              <p className="text-gray-700 dark:text-gray-300 leading-relaxed bg-white/50 dark:bg-slate-800/50 p-4 rounded-lg border border-blue-100 dark:border-blue-700">
                                {group.candidacies[0].motivation}
                              </p>
                            </div>
                          )}
                          {group.candidacies[0].programme && (
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-6 border border-green-200 dark:border-green-800">
                              <h4 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-4 flex items-center">
                                <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center mr-3">
                                  <span className="text-white text-xs font-bold">P</span>
                                </div>
                                Programme
                              </h4>
                              <p className="text-gray-700 dark:text-gray-300 leading-relaxed bg-white/50 dark:bg-slate-800/50 p-4 rounded-lg border border-green-100 dark:border-green-700">
                                {group.candidacies[0].programme}
                              </p>
                            </div>
                          )}
                          {group.election.status !== ElectionStatus.Ouverte && (
                            <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                              <div className="flex items-center">
                                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mr-3" />
                                <span className="text-amber-800 dark:text-amber-200 font-medium">
                                  Cette élection n'est plus ouverte aux modifications
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ));
              })()}
            </div>
          </div>
        )}

        {/* Liste des élections avec candidatures utilisateur */}
        {elections && elections.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Élections avec mes candidatures
            </h2>
            <div className="space-y-6">
              {elections.map((election) => (
                election && (
                <Card key={election.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-xl">{election.titre}</CardTitle>
                        <CardDescription className="mt-1">
                          <div className="flex items-center space-x-4 text-sm">
                            <span className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1" />
                              Ouverture: {new Date(election.dateOuverture).toLocaleDateString()}
                            </span>
                            <span className="flex items-center">
                              <Clock className="h-4 w-4 mr-1" />
                              Clôture: {new Date(election.dateCloture).toLocaleDateString()}
                            </span>
                          </div>
                        </CardDescription>
                      </div>
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        Ouverte
                      </Badge>
                    </div>
                  </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {election.positions.map((position) => (
                    <div key={position.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">
                          {POSTES_LABELS[position.type]}
                        </h3>
                        <Badge variant="outline">
                          {position.candidacies?.length || 0} candidature(s)
                        </Badge>
                      </div>

                      {position.candidacies && position.candidacies.length > 0 ? (
                        <div className="space-y-3">
                          {position.candidacies && position.candidacies.map((candidacy) => (
                            candidacy && (
                            <div key={candidacy.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <h4 className="font-medium">
                                    {candidacy.adherent.firstname} {candidacy.adherent.lastname}
                                  </h4>
                                  <p className="text-sm text-gray-600 dark:text-gray-300">
                                    {candidacy.adherent.User.email}
                                  </p>
                                </div>
                                <Badge className={getStatusColor(candidacy.status)}>
                                  {getStatusLabel(candidacy.status)}
                                </Badge>
                              </div>
                              
                              {candidacy.motivation && (
                                <div className="mb-3">
                                  <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Motivation:
                                  </h5>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {candidacy.motivation}
                                  </p>
                                </div>
                              )}

                              {candidacy.programme && (
                                <div>
                                  <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Programme:
                                  </h5>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {candidacy.programme}
                                  </p>
                                </div>
                              )}
                            </div>
                            )
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                          <Users className="h-8 w-8 mx-auto mb-2" />
                          <p>Aucune candidature pour ce poste</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            )
          ))}
            </div>
          </div>
        )}

        {elections && elections.length === 0 && userCandidacies && userCandidacies.length > 0 && (
          <div className="text-center py-12">
            <Vote className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Aucune élection avec candidatures
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Vos candidatures ne sont pas dans des élections ouvertes actuellement
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
