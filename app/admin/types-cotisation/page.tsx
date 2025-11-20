"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Settings, 
  Euro, 
  Plus, 
  Edit, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Users,
  Calendar
} from "lucide-react";
import { toast } from "sonner";
import { 
  getAllTypesCotisationMensuelle, 
  createTypeCotisationMensuelle, 
  updateTypeCotisationMensuelle,
  deleteTypeCotisationMensuelle,
  getCotisationsMensuellesStats
} from "@/actions/cotisations-mensuelles";

interface TypeCotisationMensuelle {
  id: string;
  nom: string;
  description?: string;
  montant: number;
  obligatoire: boolean;
  actif: boolean;
  ordre: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  CreatedBy: {
    id: string;
    email: string;
  };
  _count: {
    CotisationsMensuelles: number;
  };
}

interface Stats {
  totalTypesCotisation: number;
  typesActifs: number;
  totalCotisationsMois: number;
  totalDettes: number;
  adherentsEnRetard: number;
}

export default function AdminTypesCotisationMensuelle() {
  const [typesCotisation, setTypesCotisation] = useState<TypeCotisationMensuelle[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingType, setEditingType] = useState<TypeCotisationMensuelle | null>(null);
  const [formData, setFormData] = useState({
    nom: "",
    description: "",
    montant: 0,
    obligatoire: true,
    actif: true,
    ordre: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [typesResult, statsResult] = await Promise.all([
        getAllTypesCotisationMensuelle(),
        getCotisationsMensuellesStats()
      ]);

      if (typesResult.success) {
        setTypesCotisation(typesResult.data);
      } else {
        toast.error(typesResult.error);
      }

      if (statsResult.success) {
        setStats(statsResult.data);
      }
    } catch (error) {
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let result;
      if (editingType) {
        result = await updateTypeCotisationMensuelle({
          id: editingType.id,
          ...formData,
        });
      } else {
        result = await createTypeCotisationMensuelle(formData);
      }

      if (result.success) {
        toast.success(editingType ? "Type mis à jour" : "Type créé");
        setShowForm(false);
        setEditingType(null);
        setFormData({
          nom: "",
          description: "",
          montant: 0,
          obligatoire: true,
          actif: true,
          ordre: 0,
        });
        loadData();
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce type de cotisation ?")) return;

    try {
      const result = await deleteTypeCotisationMensuelle(id);
      if (result.success) {
        toast.success("Type supprimé");
        loadData();
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleEdit = (type: TypeCotisationMensuelle) => {
    setEditingType(type);
    setFormData({
      nom: type.nom,
      description: type.description || "",
      montant: type.montant,
      obligatoire: type.obligatoire,
      actif: type.actif,
      ordre: type.ordre,
    });
    setShowForm(true);
  };

  if (loading && typesCotisation.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <Clock className="h-5 w-5 animate-spin text-blue-600" />
          <span className="text-gray-600">Chargement des types de cotisation...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Types de Cotisation Mensuelle
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Gérer les types de cotisation mensuelle et leurs paramètres
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingType(null);
            setFormData({
              nom: "",
              description: "",
              montant: 0,
              obligatoire: true,
              actif: true,
              ordre: 0,
            });
            setShowForm(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nouveau Type
        </Button>
      </div>

      {/* Statistiques */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Total Types
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.totalTypesCotisation}
                  </p>
                </div>
                <Settings className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Types Actifs
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    {stats.typesActifs}
                  </p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-600" />
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
                  <p className="text-2xl font-bold text-purple-600">
                    {stats.totalCotisationsMois}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-purple-600" />
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
                <Euro className="h-8 w-8 text-orange-600" />
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
        </div>
      )}

      {/* Liste des types */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {typesCotisation.map((type) => (
          <Card key={type.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{type.nom}</CardTitle>
                  <CardDescription className="mt-1">
                    {type.description || "Aucune description"}
                  </CardDescription>
                </div>
                <div className="flex space-x-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(type)}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(type.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Montant
                  </span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {type.montant.toFixed(2).replace('.', ',')} €
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Statut
                  </span>
                  <Badge 
                    className={
                      type.actif 
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
                        : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                    }
                  >
                    {type.actif ? "Actif" : "Inactif"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Type
                  </span>
                  <Badge 
                    className={
                      type.obligatoire 
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" 
                        : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                    }
                  >
                    {type.obligatoire ? "Obligatoire" : "Optionnel"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Ordre
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    #{type.ordre}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Utilisations
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {type._count.CotisationsMensuelles} cotisation(s)
                  </span>
                </div>

                <div className="pt-2 border-t">
                  <p className="text-xs text-gray-500">
                    Créé par: {type.CreatedBy.email}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(type.createdAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Modal de création/édition */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>
                {editingType ? "Modifier le Type" : "Nouveau Type de Cotisation"}
              </CardTitle>
              <CardDescription>
                {editingType ? "Modifier les paramètres du type" : "Créer un nouveau type de cotisation mensuelle"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nom">Nom *</Label>
                    <Input
                      id="nom"
                      value={formData.nom}
                      onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                      placeholder="ex: Forfait Mensuel"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="montant">Montant *</Label>
                    <div className="relative">
                      <Input
                        id="montant"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.montant}
                        onChange={(e) => setFormData({ ...formData, montant: parseFloat(e.target.value) })}
                        placeholder="0.00"
                        required
                      />
                      <Euro className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                    </div>
                    {editingType && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        ⚠️ La modification du montant n'affectera que les futures cotisations. Les cotisations déjà créées conservent leur montant initial.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ordre">Ordre d'affichage</Label>
                    <Input
                      id="ordre"
                      type="number"
                      min="0"
                      value={formData.ordre}
                      onChange={(e) => setFormData({ ...formData, ordre: parseInt(e.target.value) })}
                      placeholder="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="obligatoire">Type</Label>
                    <select
                      id="obligatoire"
                      value={formData.obligatoire.toString()}
                      onChange={(e) => setFormData({ ...formData, obligatoire: e.target.value === 'true' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="true">Obligatoire</option>
                      <option value="false">Optionnel</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Description du type de cotisation"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    rows={3}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="actif"
                    checked={formData.actif}
                    onChange={(e) => setFormData({ ...formData, actif: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <Label htmlFor="actif">Type actif (peut être utilisé)</Label>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowForm(false)}
                  >
                    Annuler
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {loading ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Sauvegarde...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        {editingType ? "Modifier" : "Créer"}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Informations importantes */}
      <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
        <AlertDescription className="space-y-2">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-800 dark:text-amber-200">
                Informations Importantes
              </h3>
              <ul className="mt-2 text-sm text-amber-700 dark:text-amber-300 space-y-1">
                <li>• Les types obligatoires sont automatiquement inclus dans les cotisations mensuelles</li>
                <li>• Les types optionnels peuvent être ajoutés selon les besoins</li>
                <li>• L'ordre détermine l'affichage dans les interfaces</li>
                <li>• Un type inactif ne peut pas être utilisé pour créer de nouvelles cotisations</li>
                <li>• La suppression d'un type est impossible s'il est utilisé dans des cotisations</li>
              </ul>
            </div>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
