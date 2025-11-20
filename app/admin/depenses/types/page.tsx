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
  Plus, 
  Edit, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Receipt,
  ArrowLeft
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { 
  getAllTypesDepense, 
  createTypeDepense, 
  updateTypeDepense,
  deleteTypeDepense
} from "@/actions/depenses/types";

interface TypeDepense {
  id: string;
  titre: string;
  description?: string;
  actif: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  CreatedBy: {
    id: string;
    email: string;
  };
  _count: {
    Depenses: number;
  };
}

export default function AdminTypesDepense() {
  const [typesDepense, setTypesDepense] = useState<TypeDepense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingType, setEditingType] = useState<TypeDepense | null>(null);
  const [formData, setFormData] = useState({
    titre: "",
    description: "",
    actif: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const typesResult = await getAllTypesDepense();

      if (typesResult.success) {
        setTypesDepense(typesResult.data || []);
      } else {
        toast.error(typesResult.error);
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
        result = await updateTypeDepense({
          id: editingType.id,
          ...formData,
        });
      } else {
        result = await createTypeDepense(formData);
      }

      if (result.success) {
        toast.success(editingType ? "Type mis à jour" : "Type créé");
        setShowForm(false);
        setEditingType(null);
        setFormData({
          titre: "",
          description: "",
          actif: true,
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
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce type de dépense ?")) return;

    try {
      const result = await deleteTypeDepense(id);
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

  const handleEdit = (type: TypeDepense) => {
    setEditingType(type);
    setFormData({
      titre: type.titre,
      description: type.description || "",
      actif: type.actif,
    });
    setShowForm(true);
  };

  if (loading && typesDepense.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <Clock className="h-5 w-5 animate-spin text-blue-600" />
          <span className="text-gray-600">Chargement des types de dépense...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* En-tête */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link href="/admin/depenses">
                <Button variant="ghost" size="sm" className="text-gray-600 dark:text-gray-300">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Retour
                </Button>
              </Link>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-orange-600 to-orange-800 dark:from-orange-400 dark:to-orange-600 bg-clip-text text-transparent">
              Types de Dépenses
            </h1>
            <p className="text-gray-700 dark:text-gray-300 mt-1 sm:mt-2 text-sm sm:text-base lg:text-lg">
              Gérer les types de dépenses et leurs paramètres
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingType(null);
              setFormData({
                titre: "",
                description: "",
                actif: true,
              });
              setShowForm(true);
            }}
            className="w-full sm:w-auto bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white shadow-lg"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nouveau Type
          </Button>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <Card className="!py-0 border-orange-200 dark:border-orange-800 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-4 sm:p-6 bg-gradient-to-br from-orange-50/80 to-white dark:from-orange-900/20 dark:to-gray-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-semibold text-orange-700 dark:text-orange-300 uppercase tracking-wide">
                    Total Types
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-orange-900 dark:text-orange-100 mt-1 sm:mt-2">
                    {typesDepense.length}
                  </p>
                </div>
                <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
                  <Settings className="h-6 w-6 sm:h-7 sm:w-7 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="!py-0 border-green-200 dark:border-green-800 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-4 sm:p-6 bg-gradient-to-br from-green-50/80 to-white dark:from-green-900/20 dark:to-gray-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide">
                    Types Actifs
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-green-900 dark:text-green-100 mt-1 sm:mt-2">
                    {typesDepense.filter(t => t.actif).length}
                  </p>
                </div>
                <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 sm:h-7 sm:w-7 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Liste des types */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {typesDepense.map((type) => (
            <Card key={type.id} className="!py-0 border-orange-200 dark:border-orange-800 shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="bg-gradient-to-r from-orange-500/90 to-orange-600/90 dark:from-orange-600/90 dark:to-orange-700/90 text-white rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                    <Receipt className="h-5 w-5" />
                    {type.titre}
                  </CardTitle>
                  <Badge 
                    className={
                      type.actif 
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
                        : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                    }
                  >
                    {type.actif ? "Actif" : "Inactif"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {type.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    {type.description}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-4">
                  <span>Utilisé dans {type._count.Depenses} dépense(s)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(type)}
                    className="flex-1 border-blue-300 hover:bg-blue-50 dark:border-blue-700 dark:hover:bg-blue-900/20"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Modifier
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(type.id)}
                    disabled={type._count.Depenses > 0}
                    className="flex-1 border-red-300 hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/20 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer
                  </Button>
                </div>
                {type._count.Depenses > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    ⚠️ Impossible de supprimer : utilisé dans {type._count.Depenses} dépense(s)
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {typesDepense.length === 0 && !loading && (
          <Card className="!py-0 border-orange-200 dark:border-orange-800">
            <CardContent className="p-8 text-center">
              <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-300">Aucun type de dépense créé</p>
              <Button
                onClick={() => setShowForm(true)}
                className="mt-4 bg-orange-600 hover:bg-orange-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Créer le premier type
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Modal de création/édition */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader className="bg-gradient-to-r from-orange-500/90 to-orange-600/90 dark:from-orange-600/90 dark:to-orange-700/90 text-white rounded-t-lg">
                <CardTitle>
                  {editingType ? "Modifier le Type" : "Nouveau Type de Dépense"}
                </CardTitle>
                <CardDescription className="text-orange-100 dark:text-orange-200">
                  {editingType ? "Modifier les paramètres du type" : "Créer un nouveau type de dépense"}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="titre">Titre *</Label>
                    <Input
                      id="titre"
                      value={formData.titre}
                      onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
                      placeholder="ex: Frais de fonctionnement"
                      required
                      maxLength={200}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Description du type de dépense"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      rows={3}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="actif"
                      checked={formData.actif}
                      onChange={(e) => setFormData({ ...formData, actif: e.target.checked })}
                      className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                    />
                    <Label htmlFor="actif">Type actif (peut être utilisé)</Label>
                  </div>

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowForm(false);
                        setEditingType(null);
                        setFormData({
                          titre: "",
                          description: "",
                          actif: true,
                        });
                      }}
                    >
                      Annuler
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={loading}
                      className="bg-orange-600 hover:bg-orange-700 text-white"
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
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <AlertDescription>
            <div className="mt-2 text-sm text-amber-700 dark:text-amber-300 space-y-1">
              <p>• Les types actifs peuvent être utilisés lors de la création de dépenses</p>
              <p>• Les types inactifs ne peuvent pas être sélectionnés pour de nouvelles dépenses</p>
              <p>• Un type ne peut pas être supprimé s'il est utilisé dans des dépenses existantes</p>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}

