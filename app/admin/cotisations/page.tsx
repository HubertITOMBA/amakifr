"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar, Euro, Users, AlertTriangle, CheckCircle2, Clock, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { createCotisationsMensuelles, getCotisationsMensuellesStats } from "@/actions/cotisations-mensuelles";
import { getAllTypesCotisationMensuelle } from "@/actions/cotisations-mensuelles";

interface CotisationStats {
  totalTypesCotisation: number;
  typesActifs: number;
  totalCotisationsMois: number;
  totalDettes: number;
  adherentsEnRetard: number;
}

interface TypeCotisationMensuelle {
  id: string;
  nom: string;
  description?: string;
  montant: number;
  obligatoire: boolean;
  actif: boolean;
  ordre: number;
}

export default function AdminCotisationCreation() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<CotisationStats | null>(null);
  const [typesCotisation, setTypesCotisation] = useState<TypeCotisationMensuelle[]>([]);
  const [formData, setFormData] = useState({
    mois: new Date().getMonth() + 1,
    annee: new Date().getFullYear(),
    typeCotisationIds: [] as string[],
  });

  const moisOptions = [
    { value: 1, label: "Janvier" },
    { value: 2, label: "Février" },
    { value: 3, label: "Mars" },
    { value: 4, label: "Avril" },
    { value: 5, label: "Mai" },
    { value: 6, label: "Juin" },
    { value: 7, label: "Juillet" },
    { value: 8, label: "Août" },
    { value: 9, label: "Septembre" },
    { value: 10, label: "Octobre" },
    { value: 11, label: "Novembre" },
    { value: 12, label: "Décembre" },
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsResult, typesResult] = await Promise.all([
        getCotisationsMensuellesStats(),
        getAllTypesCotisationMensuelle()
      ]);

      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data);
      }

      if (typesResult.success && typesResult.data) {
        setTypesCotisation(typesResult.data);
        // Sélectionner automatiquement les types obligatoires
        const typesObligatoires = typesResult.data
          .filter((type: TypeCotisationMensuelle) => type.obligatoire && type.actif)
          .map((type: TypeCotisationMensuelle) => type.id);
        setFormData(prev => ({ ...prev, typeCotisationIds: typesObligatoires }));
      }
    } catch (error) {
      console.error("Erreur lors du chargement des données:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Vérifier qu'au moins le forfait est sélectionné
    const forfaitSelected = formData.typeCotisationIds.some(id => {
      const type = typesCotisation.find(t => t.id === id);
      return type && type.nom.toLowerCase().includes('forfait');
    });
    
    if (!forfaitSelected) {
      toast.error("Veuillez sélectionner au moins le type 'Forfait Mensuel'. Les assistances du mois seront automatiquement ajoutées.");
      return;
    }
    
    setLoading(true);

    try {
      // La logique utilise automatiquement le forfait et ajoute les assistances du mois
      const result = await createCotisationsMensuelles({
        periode: `${formData.annee}-${formData.mois.toString().padStart(2, '0')}`,
        annee: formData.annee,
        mois: formData.mois,
        typeCotisationIds: formData.typeCotisationIds, // Utilisé pour trouver le forfait
      });

      if (result.success) {
        toast.success(result.message);
        setFormData({
          mois: new Date().getMonth() + 1,
          annee: new Date().getFullYear(),
          typeCotisationIds: typesCotisation
            .filter(type => type.obligatoire && type.actif)
            .map(type => type.id),
        });
        loadData(); // Recharger les données
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("Erreur lors de la création des cotisations");
    } finally {
      setLoading(false);
    }
  };

  // Trouver le forfait pour afficher le montant de base
  const typeForfait = typesCotisation.find(t => 
    t.id && formData.typeCotisationIds.includes(t.id) && 
    t.nom.toLowerCase().includes('forfait')
  );
  const montantForfait = typeForfait ? typeForfait.montant : 0;
  
  // Note: Le total réel sera calculé côté serveur (forfait + assistances du mois par adhérent)

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Création des Cotisations Mensuelles
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Générer les obligations de cotisation pour tous les adhérents actifs
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Calendar className="h-6 w-6 text-blue-600" />
          <span className="text-sm text-gray-500">
            {new Date().toLocaleDateString('fr-FR', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </span>
        </div>
      </div>

      {/* Statistiques */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Types Actifs
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.typesActifs}
                  </p>
                </div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    En Retard
                  </p>
                  <p className="text-2xl font-bold text-red-600">
                    {stats.adherentsEnRetard}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Total Dettes
                  </p>
                  <p className="text-2xl font-bold text-orange-600">
                    {stats.totalDettes.toFixed(2).replace('.', ',')} €
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Cotisations Mois
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    {stats.totalCotisationsMois}
                  </p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Formulaire de création */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            <span>Nouvelles Cotisations Mensuelles</span>
          </CardTitle>
          <CardDescription>
            Créer les cotisations mensuelles pour tous les adhérents actifs. 
            Chaque cotisation inclut automatiquement le forfait mensuel (15€ ou montant variable) 
            + les assistances du mois s'il y en a.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Période */}
              <div className="space-y-2">
                <Label htmlFor="mois">Mois</Label>
                <Select
                  value={formData.mois.toString()}
                  onValueChange={(value) => setFormData({ ...formData, mois: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un mois" />
                  </SelectTrigger>
                  <SelectContent>
                    {moisOptions.map((mois) => (
                      <SelectItem key={mois.value} value={mois.value.toString()}>
                        {mois.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="annee">Année</Label>
                <Input
                  id="annee"
                  type="number"
                  min="2020"
                  max="2030"
                  value={formData.annee}
                  onChange={(e) => setFormData({ ...formData, annee: parseInt(e.target.value) })}
                />
              </div>

              {/* Types de Cotisation */}
              <div className="space-y-2 md:col-span-2">
                <Label>Types de Cotisation à Inclure</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {typesCotisation.map((type) => (
                    <div key={type.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                      <input
                        type="checkbox"
                        id={`type-${type.id}`}
                        checked={formData.typeCotisationIds.includes(type.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData(prev => ({
                              ...prev,
                              typeCotisationIds: [...prev.typeCotisationIds, type.id]
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              typeCotisationIds: prev.typeCotisationIds.filter(id => id !== type.id)
                            }));
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <label htmlFor={`type-${type.id}`} className="font-medium text-gray-900 dark:text-white cursor-pointer">
                          {type.nom}
                        </label>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-sm text-gray-600 dark:text-gray-300">
                            {type.description}
                          </span>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-gray-900 dark:text-white">
                              {type.montant.toFixed(2).replace('.', ',')} €
                            </span>
                            <Badge 
                              className={
                                type.obligatoire 
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs" 
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 text-xs"
                              }
                            >
                              {type.obligatoire ? "Obligatoire" : "Optionnel"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Résumé */}
            <Alert>
              <AlertDescription className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Forfait mensuel :</span>
                  <span className="font-bold text-lg">
                    {montantForfait.toFixed(2).replace('.', ',')} €
                  </span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  + assistances du mois (ajoutées automatiquement si présentes)
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300 mt-3">
                  <div className="mb-2">
                    <strong>Note :</strong> Chaque cotisation mensuelle inclut automatiquement le forfait + les assistances du mois pour chaque adhérent.
                  </div>
                  {formData.typeCotisationIds.length > 0 ? (
                    formData.typeCotisationIds.map(typeId => {
                      const type = typesCotisation.find(t => t.id === typeId);
                      return type ? (
                        <div key={typeId} className="flex justify-between">
                          <span>• {type.nom} :</span>
                          <span>{type.montant.toFixed(2).replace('.', ',')} €</span>
                        </div>
                      ) : null;
                    })
                  ) : (
                    <div className="text-red-600">Aucun type sélectionné</div>
                  )}
                  <div className="mt-2 pt-2 border-t">
                    <strong>Période :</strong> {moisOptions.find(m => m.value === formData.mois)?.label} {formData.annee}
                  </div>
                </div>
              </AlertDescription>
            </Alert>

            {/* Bouton de soumission */}
            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormData({
                  mois: new Date().getMonth() + 1,
                  annee: new Date().getFullYear(),
                  typeCotisationIds: typesCotisation
                    .filter(type => type.obligatoire && type.actif)
                    .map(type => type.id),
                })}
              >
                Réinitialiser
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Création en cours...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Créer les Cotisations
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Informations importantes */}
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
        <CardContent className="p-6">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-800 dark:text-amber-200">
                Informations Importantes
              </h3>
              <ul className="mt-2 text-sm text-amber-700 dark:text-amber-300 space-y-1">
                <li>• Les cotisations seront créées pour tous les adhérents actifs</li>
                <li>• La date d'échéance sera fixée au 15 du mois sélectionné</li>
                <li>• Les adhérents recevront une notification de leur obligation</li>
                <li>• Un système de relance automatique sera activé pour les retards</li>
                <li>• Les montants peuvent être modifiés avant la création</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
