"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Loader2, FolderKanban, Calendar, FileText, Users, MessageSquare, X, Plus, Edit, Trash2, UserPlus } from "lucide-react";
import { getProjetById, createSousProjet, updateSousProjet, deleteSousProjet, affecterSousProjet, retirerAffectation } from "@/actions/projets";
import { toast } from "react-toastify";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateSousProjetDialog } from "./CreateSousProjetDialog";
import { EditSousProjetDialog } from "./EditSousProjetDialog";
import { AffecterSousProjetDialog } from "./AffecterSousProjetDialog";
import { getAllAdherentsForSelect } from "@/actions/user";
import Link from "next/link";

interface ViewProjetDialogProps {
  projetId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Fonction pour obtenir la couleur du badge selon le statut
const getStatutBadgeColor = (statut: string) => {
  switch (statut) {
    case "APlanifier":
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700";
    case "EnAttente":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800";
    case "EnCours":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800";
    case "EnPause":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800";
    case "Terminee":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800";
    case "Annulee":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700";
  }
};

export function ViewProjetDialog({ projetId, open, onOpenChange }: ViewProjetDialogProps) {
  const [loading, setLoading] = useState(true);
  const [projet, setProjet] = useState<any>(null);
  const [createSousProjetOpen, setCreateSousProjetOpen] = useState(false);
  const [editSousProjetOpen, setEditSousProjetOpen] = useState<any>(null);
  const [affecterDialogOpen, setAffecterDialogOpen] = useState<any>(null);

  const loadProjet = async () => {
    try {
      setLoading(true);
      const result = await getProjetById(projetId);
      if (result.success && result.data) {
        setProjet(result.data);
      } else {
        toast.error(result.error || "Erreur lors du chargement du projet");
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement du projet");
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && projetId) {
      loadProjet();
    }
  }, [open, projetId]);

  const handleDeleteSousProjet = async (sousProjetId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette tâche ?")) {
      return;
    }

    try {
      const result = await deleteSousProjet(sousProjetId);
      if (result.success) {
        toast.success(result.message);
        loadProjet();
      } else {
        toast.error(result.error || "Erreur lors de la suppression");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleRetirerAffectation = async (affectationId: string) => {
    try {
      const result = await retirerAffectation(affectationId);
      if (result.success) {
        toast.success(result.message);
        loadProjet();
      } else {
        toast.error(result.error || "Erreur lors du retrait");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du retrait");
    }
  };

  const handleAffecterDialogClose = useCallback((open: boolean) => {
    if (!open) {
      setAffecterDialogOpen(null);
    }
  }, []);

  if (!open) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="bg-gradient-to-r from-blue-500/90 via-blue-400/80 to-blue-500/90 dark:from-blue-700/50 dark:via-blue-600/40 dark:to-blue-700/50 text-white px-6 pt-6 pb-4 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-white text-lg font-bold flex items-center gap-2">
                  <FolderKanban className="h-5 w-5 text-white" />
                  {loading ? "Chargement..." : projet?.titre}
                </DialogTitle>
                <DialogDescription className="text-blue-50 dark:text-blue-100 text-sm mt-2">
                  {projet && `Créé le ${format(new Date(projet.createdAt), "dd/MM/yyyy", { locale: fr })} par ${projet.CreatedBy?.name || projet.CreatedBy?.email || "Inconnu"}`}
                </DialogDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-white hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : projet ? (
            <div className="p-6 bg-white dark:bg-gray-900 space-y-6">
              {/* Informations du projet */}
              <Card className="!py-0 border-blue-200 dark:border-blue-800">
                <CardHeader className="bg-blue-50 dark:bg-blue-900/20">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Informations du projet
                    </CardTitle>
                    <Badge className={getStatutBadgeColor(projet.statut)}>
                      {projet.statut}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div>
                    <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 px-2 py-1 rounded-t-md">
                      <FileText className="h-3 w-3" />
                      Description
                    </Label>
                    <p className="p-2 sm:p-2.5 bg-blue-50 rounded-md rounded-tl-none border border-blue-200 border-t-0 text-xs font-medium text-slate-900">
                      {projet.description}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {projet.dateDebut && (
                      <div>
                        <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 px-2 py-1 rounded-t-md">
                          <Calendar className="h-3 w-3" />
                          Date de début
                        </Label>
                        <p className="p-2 sm:p-2.5 bg-blue-50 rounded-md rounded-tl-none border border-blue-200 border-t-0 text-xs font-medium text-slate-900 font-mono">
                          {format(new Date(projet.dateDebut), "dd/MM/yyyy", { locale: fr })}
                        </p>
                      </div>
                    )}
                    {projet.dateFin && (
                      <div>
                        <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 px-2 py-1 rounded-t-md">
                          <Calendar className="h-3 w-3" />
                          Date de fin
                        </Label>
                        <p className="p-2 sm:p-2.5 bg-blue-50 rounded-md rounded-tl-none border border-blue-200 border-t-0 text-xs font-medium text-slate-900 font-mono">
                          {format(new Date(projet.dateFin), "dd/MM/yyyy", { locale: fr })}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Sous-projets/Tâches */}
              <Card className="!py-0 border-purple-200 dark:border-purple-800">
                <CardHeader className="bg-purple-50 dark:bg-purple-900/20">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Tâches ({projet.SousProjets?.length || 0})
                    </CardTitle>
                    <Button
                      size="sm"
                      onClick={() => setCreateSousProjetOpen(true)}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Nouvelle tâche
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  {projet.SousProjets && projet.SousProjets.length > 0 ? (
                    <div className="space-y-4">
                      {projet.SousProjets.map((sousProjet: any) => (
                        <Card key={sousProjet.id} className="border-gray-200 dark:border-gray-700">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <CardTitle className="text-sm font-semibold">
                                    {sousProjet.titre}
                                  </CardTitle>
                                  <Badge className={getStatutBadgeColor(sousProjet.statut)}>
                                    {sousProjet.statut}
                                  </Badge>
                                </div>
                                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                                  {sousProjet.description}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 w-7 p-0 border-blue-300 hover:bg-blue-50"
                                  onClick={() => setEditSousProjetOpen(sousProjet)}
                                  title="Modifier"
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 w-7 p-0 border-red-300 hover:bg-red-50"
                                  onClick={() => handleDeleteSousProjet(sousProjet.id)}
                                  title="Supprimer"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0 space-y-3">
                            {/* Adhérents affectés */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <Label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  Adhérents affectés ({sousProjet.Affectations?.length || 0})
                                </Label>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-xs"
                                  onClick={() => setAffecterDialogOpen(sousProjet)}
                                >
                                  <UserPlus className="h-3 w-3 mr-1" />
                                  Affecter
                                </Button>
                              </div>
                              {sousProjet.Affectations && sousProjet.Affectations.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                  {sousProjet.Affectations.map((affectation: any) => (
                                    <Badge
                                      key={affectation.id}
                                      variant="outline"
                                      className="flex items-center gap-1"
                                    >
                                      {affectation.Adherent.firstname} {affectation.Adherent.lastname}
                                      {affectation.responsable && (
                                        <span className="text-xs">(Responsable)</span>
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-4 w-4 p-0 ml-1 hover:bg-red-100"
                                        onClick={() => handleRetirerAffectation(affectation.id)}
                                        title="Retirer"
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-gray-500">Aucun adhérent affecté</p>
                              )}
                            </div>

                            {/* Commentaires récents */}
                            {sousProjet.Commentaires && sousProjet.Commentaires.length > 0 && (
                              <div>
                                <Label className="text-xs font-semibold text-gray-700 flex items-center gap-1 mb-2">
                                  <MessageSquare className="h-3 w-3" />
                                  Derniers commentaires ({sousProjet.Commentaires.length})
                                </Label>
                                <div className="space-y-2 max-h-32 overflow-y-auto">
                                  {sousProjet.Commentaires.slice(0, 3).map((commentaire: any) => (
                                    <div
                                      key={commentaire.id}
                                      className="text-xs p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
                                    >
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="font-medium">
                                          {commentaire.Adherent.firstname} {commentaire.Adherent.lastname}
                                        </span>
                                        <span className="text-gray-500">
                                          {format(new Date(commentaire.createdAt), "dd/MM/yyyy HH:mm", { locale: fr })}
                                        </span>
                                      </div>
                                      <p className="text-gray-700 dark:text-gray-300">{commentaire.contenu}</p>
                                      {commentaire.pourcentageAvancement !== null && (
                                        <div className="mt-1">
                                          <div className="flex items-center justify-between text-xs mb-1">
                                            <span>Avancement</span>
                                            <span className="font-semibold">{commentaire.pourcentageAvancement}%</span>
                                          </div>
                                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                            <div
                                              className="bg-blue-600 h-2 rounded-full"
                                              style={{ width: `${commentaire.pourcentageAvancement}%` }}
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">
                      Aucune tâche pour ce projet
                    </p>
                  )}
                </CardContent>
              </Card>

              <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-gray-200 dark:border-gray-700 mt-4 sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="w-full sm:w-auto border-gray-300 dark:border-gray-600"
                >
                  Fermer
                </Button>
                <Link href={`/admin/projets/${projetId}`}>
                  <Button className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white">
                    Voir les détails complets
                  </Button>
                </Link>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Dialogs pour les sous-projets */}
      {createSousProjetOpen && projet && (
        <CreateSousProjetDialog
          projetId={projet.id}
          open={createSousProjetOpen}
          onOpenChange={setCreateSousProjetOpen}
          onSuccess={loadProjet}
        />
      )}

      {editSousProjetOpen && (
        <EditSousProjetDialog
          sousProjet={editSousProjetOpen}
          open={!!editSousProjetOpen}
          onOpenChange={(open) => {
            if (!open) setEditSousProjetOpen(null);
          }}
          onSuccess={loadProjet}
        />
      )}

      {affecterDialogOpen && (
        <AffecterSousProjetDialog
          key={affecterDialogOpen.id}
          sousProjet={affecterDialogOpen}
          open={!!affecterDialogOpen}
          onOpenChange={handleAffecterDialogClose}
          onSuccess={loadProjet}
        />
      )}
    </>
  );
}
