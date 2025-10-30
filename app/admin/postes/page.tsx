"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Settings, 
  Plus, 
  Edit, 
  Trash2, 
  CheckCircle2, 
  XCircle,
  AlertTriangle,
  Users,
  Building2,
  ArrowUp,
  ArrowDown,
  Power,
  PowerOff
} from "lucide-react";
import { toast } from "sonner";
import { 
  getAllPostesTemplates, 
  createPosteTemplate, 
  updatePosteTemplate,
  deletePosteTemplate,
  togglePosteTemplateStatus
} from "@/actions/postes";

interface PosteTemplate {
  id: string;
  code: string;
  libelle: string;
  description?: string;
  ordre: number;
  actif: boolean;
  nombreMandatsDefaut: number;
  dureeMandatDefaut?: number;
  createdAt: string;
  updatedAt: string;
  CreatedBy: {
    id: string;
    name: string;
    email: string;
  };
  _count: {
    positions: number;
  };
}

export default function AdminPostesPage() {
  const [postes, setPostes] = useState<PosteTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPoste, setEditingPoste] = useState<PosteTemplate | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    libelle: "",
    description: "",
    ordre: 0,
    actif: true,
    nombreMandatsDefaut: 1,
    dureeMandatDefaut: undefined as number | undefined,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await getAllPostesTemplates(false);
      
      if (result.success && result.data) {
        setPostes(result.data as PosteTemplate[]);
      } else {
        toast.error(result.error || "Erreur lors du chargement des postes");
      }
    } catch (error) {
      console.error("Erreur:", error);
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
      if (editingPoste) {
        result = await updatePosteTemplate(editingPoste.id, formData);
      } else {
        result = await createPosteTemplate(formData);
      }

      if (result.success) {
        toast.success(editingPoste ? "Poste mis à jour avec succès" : "Poste créé avec succès");
        setShowForm(false);
        setEditingPoste(null);
        resetForm();
        loadData();
      } else {
        toast.error(result.error || "Erreur lors de la sauvegarde");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce poste ? Cette action est irréversible si aucune élection n'utilise ce poste.")) return;

    try {
      const result = await deletePosteTemplate(id);
      if (result.success) {
        toast.success("Poste supprimé avec succès");
        loadData();
      } else {
        toast.error(result.error || "Erreur lors de la suppression");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleToggleStatus = async (id: string, actif: boolean) => {
    try {
      const result = await togglePosteTemplateStatus(id, !actif);
      if (result.success) {
        toast.success(actif ? "Poste désactivé" : "Poste activé");
        loadData();
      } else {
        toast.error(result.error || "Erreur lors de la modification");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la modification");
    }
  };

  const handleEdit = (poste: PosteTemplate) => {
    setEditingPoste(poste);
    setFormData({
      code: poste.code,
      libelle: poste.libelle,
      description: poste.description || "",
      ordre: poste.ordre,
      actif: poste.actif,
      nombreMandatsDefaut: poste.nombreMandatsDefaut,
      dureeMandatDefaut: poste.dureeMandatDefaut,
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      code: "",
      libelle: "",
      description: "",
      ordre: 0,
      actif: true,
      nombreMandatsDefaut: 1,
      dureeMandatDefaut: undefined,
    });
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingPoste(null);
    resetForm();
  };

  // Trier les postes par ordre puis par libellé
  const sortedPostes = [...postes].sort((a, b) => {
    if (a.ordre !== b.ordre) return a.ordre - b.ordre;
    return a.libelle.localeCompare(b.libelle);
  });

  // Générer un code à partir du libellé si vide
  const generateCode = (libelle: string) => {
    return libelle
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
  };

  const handleLibelleChange = (libelle: string) => {
    setFormData((prev) => ({
      ...prev,
      libelle,
      code: prev.code || generateCode(libelle),
    }));
  };

  if (loading && postes.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            Gestion des Postes Électoraux
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Gérez les postes disponibles pour les élections
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau poste
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>
              {editingPoste ? "Modifier le poste" : "Nouveau poste"}
            </CardTitle>
            <CardDescription>
              {editingPoste 
                ? "Modifiez les informations du poste électoral"
                : "Renseignez les informations pour créer un nouveau poste électoral"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="libelle">
                    Libellé <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="libelle"
                    value={formData.libelle}
                    onChange={(e) => handleLibelleChange(e.target.value)}
                    placeholder="Ex: Président"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="code">
                    Code <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="Ex: president"
                    required
                    pattern="[a-z0-9_]+"
                    title="Le code doit contenir uniquement des lettres minuscules, des chiffres et des underscores"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Code unique (minuscules, chiffres et underscores uniquement)
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description du poste..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="ordre">Ordre d'affichage</Label>
                  <Input
                    id="ordre"
                    type="number"
                    value={formData.ordre}
                    onChange={(e) => setFormData({ ...formData, ordre: parseInt(e.target.value) || 0 })}
                    min="0"
                  />
                </div>

                <div>
                  <Label htmlFor="nombreMandatsDefaut">
                    Nombre de mandats par défaut
                  </Label>
                  <Input
                    id="nombreMandatsDefaut"
                    type="number"
                    value={formData.nombreMandatsDefaut}
                    onChange={(e) => setFormData({ ...formData, nombreMandatsDefaut: parseInt(e.target.value) || 1 })}
                    min="1"
                  />
                </div>

                <div>
                  <Label htmlFor="dureeMandatDefaut">
                    Durée du mandat (mois)
                  </Label>
                  <Input
                    id="dureeMandatDefaut"
                    type="number"
                    value={formData.dureeMandatDefaut || ""}
                    onChange={(e) => setFormData({ ...formData, dureeMandatDefaut: e.target.value ? parseInt(e.target.value) : undefined })}
                    min="1"
                    placeholder="Ex: 24"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="actif"
                  checked={formData.actif}
                  onChange={(e) => setFormData({ ...formData, actif: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="actif" className="cursor-pointer">
                  Poste actif (disponible pour les nouvelles élections)
                </Label>
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={loading}>
                  {editingPoste ? "Modifier" : "Créer"}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Annuler
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {sortedPostes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                Aucun poste défini pour le moment.
              </p>
              <Button className="mt-4" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Créer le premier poste
              </Button>
            </CardContent>
          </Card>
        ) : (
          sortedPostes.map((poste) => (
            <Card key={poste.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold">{poste.libelle}</h3>
                      <Badge variant={poste.actif ? "default" : "secondary"}>
                        {poste.actif ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Actif
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3 mr-1" />
                            Inactif
                          </>
                        )}
                      </Badge>
                      {poste._count.positions > 0 && (
                        <Badge variant="outline">
                          <Users className="h-3 w-3 mr-1" />
                          {poste._count.positions} élection(s)
                        </Badge>
                      )}
                    </div>
                    
                    <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      <p>
                        <strong>Code:</strong> <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{poste.code}</code>
                      </p>
                      {poste.description && (
                        <p>
                          <strong>Description:</strong> {poste.description}
                        </p>
                      )}
                      <div className="flex gap-4 mt-2">
                        <p>
                          <strong>Ordre:</strong> {poste.ordre}
                        </p>
                        <p>
                          <strong>Mandats par défaut:</strong> {poste.nombreMandatsDefaut}
                        </p>
                        {poste.dureeMandatDefaut && (
                          <p>
                            <strong>Durée:</strong> {poste.dureeMandatDefaut} mois
                          </p>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Créé le {new Date(poste.createdAt).toLocaleDateString('fr-FR')} par {poste.CreatedBy.name || poste.CreatedBy.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleStatus(poste.id, poste.actif)}
                      title={poste.actif ? "Désactiver" : "Activer"}
                    >
                      {poste.actif ? (
                        <PowerOff className="h-4 w-4" />
                      ) : (
                        <Power className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(poste)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(poste.id)}
                      disabled={poste._count.positions > 0}
                      title={poste._count.positions > 0 ? "Impossible de supprimer un poste utilisé dans une élection" : "Supprimer"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

