"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Calendar, 
  Users, 
  Vote, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Plus,
  Settings,
  BarChart3,
  UserCheck,
  FileText
} from "lucide-react";
import { 
  createElection, 
  addPositionsToElection, 
  getElections,
  updateElectionStatus,
  createCustomPosition
} from "@/actions/elections";
import { POSTES_LABELS, getAllPostesFromDB } from "@/lib/elections-constants";
import { ElectionStatus, PositionType } from "@prisma/client";
import { getAllPostesTemplates } from "@/actions/postes";

interface Election {
  id: string;
  titre: string;
  description?: string;
  status: ElectionStatus;
  dateOuverture: string;
  dateCloture: string;
  dateScrutin: string;
  positions: any[];
  candidacies: any[];
  _count: {
    votes: number;
  };
}

interface PosteTemplate {
  id: string;
  code: string;
  libelle: string;
  description?: string;
  ordre: number;
  actif: boolean;
}

export default function ElectionsPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedPostes, setSelectedPostes] = useState<string[]>([]); // IDs de PosteTemplate
  const [postesTemplates, setPostesTemplates] = useState<PosteTemplate[]>([]);

  // Formulaire de création d'élection
  const [electionForm, setElectionForm] = useState({
    titre: "",
    description: "",
    dateOuverture: "",
    dateCloture: "",
    dateScrutin: "",
    nombreMandats: 1,
    quorumRequis: 0,
    majoriteRequis: "Absolue"
  });

  // États pour l'ajout de postes personnalisés
  const [showCustomPositionForm, setShowCustomPositionForm] = useState(false);
  const [selectedElectionId, setSelectedElectionId] = useState<string | null>(null);
  const [customPositionForm, setCustomPositionForm] = useState({
    titre: "",
    description: "",
    nombreMandats: 1,
    dureeMandat: 24,
    conditions: "Être membre actif de l'association"
  });

  // Charger les élections et les postes
  useEffect(() => {
    loadElections();
    loadPostes();
  }, []);

  const loadPostes = async () => {
    try {
      const result = await getAllPostesTemplates(true); // Seulement les actifs
      if (result.success && result.data) {
        setPostesTemplates(result.data as PosteTemplate[]);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des postes:", error);
    }
  };

  const loadElections = async () => {
    try {
      setLoading(true);
      const result = await getElections();
      if (result.success && result.elections) {
        setElections(result.elections);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des élections:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateElection = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (selectedPostes.length === 0) {
      alert("Veuillez sélectionner au moins un poste pour créer l'élection");
      return;
    }
    
    try {
      // Créer l'élection avec ses postes
      const electionResult = await createElection({
        titre: electionForm.titre,
        description: electionForm.description,
        dateOuverture: new Date(electionForm.dateOuverture),
        dateCloture: new Date(electionForm.dateCloture),
        dateScrutin: new Date(electionForm.dateScrutin),
        nombreMandats: electionForm.nombreMandats,
        quorumRequis: electionForm.quorumRequis,
        majoriteRequis: electionForm.majoriteRequis
      }, selectedPostes);

      if (!electionResult.success) {
        alert(electionResult.error);
        return;
      }

      // Recharger les élections
      await loadElections();
      
      // Réinitialiser le formulaire
      setElectionForm({
        titre: "",
        description: "",
        dateOuverture: "",
        dateCloture: "",
        dateScrutin: "",
        nombreMandats: 1,
        quorumRequis: 0,
        majoriteRequis: "Absolue"
      });
      setSelectedPostes([]);
      setShowCreateForm(false);
      
      alert("Élection créée avec succès !");

    } catch (error) {
      console.error("Erreur lors de la création:", error);
      alert("Erreur lors de la création de l'élection");
    }
  };

  const handleStatusChange = async (electionId: string, newStatus: ElectionStatus) => {
    try {
      const result = await updateElectionStatus(electionId, newStatus);
      if (result.success) {
        await loadElections();
        alert("Statut mis à jour avec succès !");
      } else {
        alert(result.error);
      }
    } catch (error) {
      console.error("Erreur lors de la mise à jour:", error);
      alert("Erreur lors de la mise à jour du statut");
    }
  };

  const togglePoste = (posteId: string) => {
    setSelectedPostes(prev => 
      prev.includes(posteId) 
        ? prev.filter(p => p !== posteId)
        : [...prev, posteId]
    );
  };

  const handleAddCustomPosition = (electionId: string) => {
    setSelectedElectionId(electionId);
    setShowCustomPositionForm(true);
  };

  const handleCreateCustomPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedElectionId) return;

    try {
      const result = await createCustomPosition(selectedElectionId, {
        type: PositionType.MembreComiteDirecteur, // Type par défaut pour les postes personnalisés
        ...customPositionForm
      });

      if (result.success) {
        await loadElections();
        setShowCustomPositionForm(false);
        setSelectedElectionId(null);
        setCustomPositionForm({
          titre: "",
          description: "",
          nombreMandats: 1,
          dureeMandat: 24,
          conditions: "Être membre actif de l'association"
        });
        alert("Poste personnalisé ajouté avec succès !");
      } else {
        alert(result.error || "Erreur lors de l'ajout du poste");
      }
    } catch (error) {
      console.error("Erreur lors de l'ajout du poste:", error);
      alert("Erreur lors de l'ajout du poste");
    }
  };

  const getStatusColor = (status: ElectionStatus) => {
    switch (status) {
      case ElectionStatus.Preparation:
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case ElectionStatus.Ouverte:
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case ElectionStatus.Cloturee:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
      case ElectionStatus.Annulee:
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getStatusLabel = (status: ElectionStatus) => {
    switch (status) {
      case ElectionStatus.Preparation:
        return "En préparation";
      case ElectionStatus.Ouverte:
        return "Ouverte";
      case ElectionStatus.Cloturee:
        return "Clôturée";
      case ElectionStatus.Annulee:
        return "Annulée";
      default:
        return status;
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Gestion des Élections
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Gérez les élections pour les 8 postes du comité directeur
          </p>
        </div>

        {/* Bouton de création */}
        <div className="mb-6">
          <Button 
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Créer une nouvelle élection
          </Button>
        </div>

        {/* Formulaire de création */}
        {showCreateForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Créer une nouvelle élection</CardTitle>
              <CardDescription>
                Configurez une nouvelle élection avec les postes à pourvoir
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateElection} className="space-y-6">
                {/* Informations générales */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="titre">Titre de l'élection</Label>
                    <Input
                      id="titre"
                      value={electionForm.titre}
                      onChange={(e) => setElectionForm({...electionForm, titre: e.target.value})}
                      placeholder="Ex: Élection du comité directeur 2024"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={electionForm.description}
                      onChange={(e) => setElectionForm({...electionForm, description: e.target.value})}
                      placeholder="Description de l'élection..."
                    />
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <Label htmlFor="dateOuverture">Date d'ouverture</Label>
                    <Input
                      id="dateOuverture"
                      type="datetime-local"
                      value={electionForm.dateOuverture}
                      onChange={(e) => setElectionForm({...electionForm, dateOuverture: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="dateCloture">Date de clôture</Label>
                    <Input
                      id="dateCloture"
                      type="datetime-local"
                      value={electionForm.dateCloture}
                      onChange={(e) => setElectionForm({...electionForm, dateCloture: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="dateScrutin">Date du scrutin</Label>
                    <Input
                      id="dateScrutin"
                      type="datetime-local"
                      value={electionForm.dateScrutin}
                      onChange={(e) => setElectionForm({...electionForm, dateScrutin: e.target.value})}
                      required
                    />
                  </div>
                </div>

                {/* Configuration */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <Label htmlFor="nombreMandats">Nombre de mandats</Label>
                    <Input
                      id="nombreMandats"
                      type="number"
                      min="1"
                      value={electionForm.nombreMandats}
                      onChange={(e) => setElectionForm({...electionForm, nombreMandats: parseInt(e.target.value)})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="quorumRequis">Quorum requis (%)</Label>
                    <Input
                      id="quorumRequis"
                      type="number"
                      min="0"
                      max="100"
                      value={electionForm.quorumRequis}
                      onChange={(e) => setElectionForm({...electionForm, quorumRequis: parseInt(e.target.value)})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="majoriteRequis">Majorité requise</Label>
                    <Select 
                      value={electionForm.majoriteRequis}
                      onValueChange={(value) => setElectionForm({...electionForm, majoriteRequis: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Absolue">Absolue</SelectItem>
                        <SelectItem value="Relative">Relative</SelectItem>
                        <SelectItem value="Qualifiée">Qualifiée</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Sélection des postes */}
                <div>
                  <Label className="text-base font-semibold">Postes à pourvoir</Label>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 mb-4">
                    Sélectionnez les postes qui seront ouverts aux candidatures et aux votes
                  </p>
                  
                  {/* Compteur de postes sélectionnés */}
                  <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                        Postes sélectionnés: {selectedPostes.length}/{postesTemplates.length}
                      </span>
                      {selectedPostes.length > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedPostes([])}
                          className="text-xs"
                        >
                          Tout désélectionner
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {postesTemplates.length > 0 ? (
                      postesTemplates
                        .sort((a, b) => a.ordre - b.ordre || a.libelle.localeCompare(b.libelle))
                        .map((poste) => (
                          <div 
                            key={poste.id} 
                            className={`p-3 border rounded-lg transition-colors cursor-pointer ${
                              selectedPostes.includes(poste.id)
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                            onClick={() => togglePoste(poste.id)}
                          >
                            <div className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                id={poste.id}
                                checked={selectedPostes.includes(poste.id)}
                                onChange={(e) => {
                                  e.stopPropagation(); // Empêcher le double clic
                                  togglePoste(poste.id);
                                }}
                                className="rounded border-gray-300"
                              />
                              <Label htmlFor={poste.id} className="text-sm font-medium cursor-pointer flex-1">
                                {poste.libelle}
                                {poste.description && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400 block mt-1">
                                    {poste.description}
                                  </span>
                                )}
                              </Label>
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="p-4 text-center text-gray-500">
                        Aucun poste disponible. Veuillez créer des postes depuis la page de gestion des postes.
                      </div>
                    )}
                  </div>

                  {/* Message d'aide */}
                  {selectedPostes.length === 0 && (
                    <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                      <div className="flex items-center">
                        <AlertCircle className="h-4 w-4 text-amber-600 mr-2" />
                        <span className="text-sm text-amber-800 dark:text-amber-200">
                          Veuillez sélectionner au moins un poste pour créer l'élection
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Boutons */}
                <div className="flex justify-end space-x-4">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => setShowCreateForm(false)}
                  >
                    Annuler
                  </Button>
                  <Button 
                    type="submit" 
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={selectedPostes.length === 0}
                  >
                    Créer l'élection
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Liste des élections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {elections.map((election) => (
            <Card key={election.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{election.titre}</CardTitle>
                    <CardDescription className="mt-1">
                      {election.description}
                    </CardDescription>
                  </div>
                  <Badge className={getStatusColor(election.status)}>
                    {getStatusLabel(election.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Dates */}
                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                      <Calendar className="h-4 w-4 mr-2" />
                      <span>Ouverture: {new Date(election.dateOuverture).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                      <Clock className="h-4 w-4 mr-2" />
                      <span>Clôture: {new Date(election.dateCloture).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                      <Vote className="h-4 w-4 mr-2" />
                      <span>Scrutin: {new Date(election.dateScrutin).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Postes à pourvoir */}
                  {election.positions.length > 0 && (
                    <div className="pt-4 border-t">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Postes à pourvoir:
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {election.positions.map((position) => (
                          <Badge 
                            key={position.id} 
                            variant="secondary"
                            className="text-xs"
                          >
                            {POSTES_LABELS[position.type as keyof typeof POSTES_LABELS]}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Statistiques */}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {election.positions.length}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        Postes
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {election._count.votes}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        Votes
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-between pt-4 border-t">
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4 mr-1" />
                      Gérer
                    </Button>
                    <Button variant="outline" size="sm">
                      <BarChart3 className="h-4 w-4 mr-1" />
                      Résultats
                    </Button>
                  </div>

                  {/* Ajouter un poste personnalisé */}
                  {election.status === ElectionStatus.Preparation && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full mt-2"
                      onClick={() => handleAddCustomPosition(election.id)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Ajouter un poste personnalisé
                    </Button>
                  )}

                  {/* Changement de statut */}
                  {election.status === ElectionStatus.Preparation && (
                    <Button 
                      onClick={() => handleStatusChange(election.id, ElectionStatus.Ouverte)}
                      className="w-full bg-green-600 hover:bg-green-700"
                      size="sm"
                    >
                      Ouvrir l'élection
                    </Button>
                  )}
                  {election.status === ElectionStatus.Ouverte && (
                    <Button 
                      onClick={() => handleStatusChange(election.id, ElectionStatus.Cloturee)}
                      className="w-full bg-gray-600 hover:bg-gray-700"
                      size="sm"
                    >
                      Clôturer l'élection
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {elections.length === 0 && (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Aucune élection
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Créez votre première élection pour commencer
            </p>
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Créer une élection
            </Button>
          </div>
        )}

        {/* Formulaire d'ajout de poste personnalisé */}
        {showCustomPositionForm && (
          <Card className="fixed inset-0 z-50 m-4 max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Ajouter un poste personnalisé</CardTitle>
              <CardDescription>
                Créez un nouveau poste pour cette élection
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateCustomPosition} className="space-y-4">
                <div>
                  <Label htmlFor="customTitre">Titre du poste</Label>
                  <Input
                    id="customTitre"
                    value={customPositionForm.titre}
                    onChange={(e) => setCustomPositionForm({...customPositionForm, titre: e.target.value})}
                    placeholder="Ex: Responsable Communication"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="customDescription">Description</Label>
                  <Textarea
                    id="customDescription"
                    value={customPositionForm.description}
                    onChange={(e) => setCustomPositionForm({...customPositionForm, description: e.target.value})}
                    placeholder="Description des responsabilités..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="customMandats">Nombre de mandats</Label>
                    <Input
                      id="customMandats"
                      type="number"
                      min="1"
                      value={customPositionForm.nombreMandats}
                      onChange={(e) => setCustomPositionForm({...customPositionForm, nombreMandats: parseInt(e.target.value)})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="customDuree">Durée (mois)</Label>
                    <Input
                      id="customDuree"
                      type="number"
                      min="1"
                      value={customPositionForm.dureeMandat}
                      onChange={(e) => setCustomPositionForm({...customPositionForm, dureeMandat: parseInt(e.target.value)})}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="customConditions">Conditions</Label>
                  <Textarea
                    id="customConditions"
                    value={customPositionForm.conditions}
                    onChange={(e) => setCustomPositionForm({...customPositionForm, conditions: e.target.value})}
                    placeholder="Conditions requises pour ce poste..."
                    rows={2}
                  />
                </div>

                <div className="flex justify-end space-x-4">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => {
                      setShowCustomPositionForm(false);
                      setSelectedElectionId(null);
                    }}
                  >
                    Annuler
                  </Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                    Ajouter le poste
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
