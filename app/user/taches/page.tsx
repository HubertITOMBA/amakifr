"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, MessageSquare, Send, Calendar, FolderKanban, Users, TrendingUp, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "react-toastify";
import { getTachesAdherent, createCommentaireTache } from "@/actions/projets";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useActivityLogger } from "@/hooks/use-activity-logger";

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

export default function UserTachesPage() {
  const [loading, setLoading] = useState(true);
  const [taches, setTaches] = useState<any[]>([]);
  const [selectedTache, setSelectedTache] = useState<string | null>(null);
  const [commentaire, setCommentaire] = useState("");
  const [pourcentageAvancement, setPourcentageAvancement] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Logger la consultation de la page
  useActivityLogger("Mes tâches", "SousProjet");

  const loadTaches = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getTachesAdherent();
      if (result.success && result.data) {
        setTaches(result.data);
      } else {
        toast.error(result.error || "Erreur lors du chargement des tâches");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement des tâches");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTaches();
  }, [loadTaches]);

  const handleSubmitCommentaire = async (sousProjetId: string) => {
    if (!commentaire.trim()) {
      toast.error("Veuillez saisir un commentaire");
      return;
    }

    setSubmitting(true);

    try {
      const form = new FormData();
      form.append("sousProjetId", sousProjetId);
      form.append("contenu", commentaire);
      if (pourcentageAvancement) {
        form.append("pourcentageAvancement", pourcentageAvancement);
      }

      const result = await createCommentaireTache(form);

      if (result.success) {
        toast.success(result.message);
        setCommentaire("");
        setPourcentageAvancement("");
        setSelectedTache(null);
        loadTaches();
      } else {
        toast.error(result.error || "Erreur lors de l'ajout du commentaire");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Une erreur s'est produite");
    } finally {
      setSubmitting(false);
    }
  };

  // Grouper les tâches par projet
  const tachesParProjet = taches.reduce((acc, affectation) => {
    const projet = affectation.SousProjet.Projet;
    const projetId = projet.id;
    
    if (!acc[projetId]) {
      acc[projetId] = {
        projet,
        taches: [],
      };
    }
    
    acc[projetId].taches.push(affectation);
    return acc;
  }, {} as Record<string, { projet: any; taches: any[] }>);

  const stats = {
    total: taches.length,
    enCours: taches.filter(t => t.SousProjet.statut === "EnCours").length,
    terminees: taches.filter(t => t.SousProjet.statut === "Terminee").length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="mx-auto max-w-7xl shadow-lg border-blue-200 dark:border-gray-700 !pt-0">
          <CardHeader className="bg-gradient-to-r from-blue-500/90 via-blue-400/80 to-blue-500/90 dark:from-blue-700/50 dark:via-blue-600/40 dark:to-blue-700/50 text-white !pt-0 rounded-t-lg">
            <div className="flex items-center justify-between pt-4 sm:pt-6 pb-4 sm:pb-6">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Mes tâches ({stats.total})
              </CardTitle>
              <Link href="/user/profile">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white/10 hover:bg-white/20 border-white/30 text-white hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Retour au profil
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {/* Statistiques */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
                <CardContent className="p-3">
                  <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Total</div>
                  <div className="text-lg font-bold text-blue-900 dark:text-blue-100">{stats.total}</div>
                </CardContent>
              </Card>
              <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
                <CardContent className="p-3">
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">En cours</div>
                  <div className="text-lg font-bold text-emerald-900 dark:text-emerald-100">{stats.enCours}</div>
                </CardContent>
              </Card>
              <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
                <CardContent className="p-3">
                  <div className="text-xs text-green-600 dark:text-green-400 font-semibold">Terminées</div>
                  <div className="text-lg font-bold text-green-900 dark:text-green-100">{stats.terminees}</div>
                </CardContent>
              </Card>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : Object.keys(tachesParProjet).length > 0 ? (
              <div className="space-y-6">
                {Object.values(tachesParProjet).map(({ projet, taches: projetTaches }) => (
                  <Card key={projet.id} className="border-gray-200 dark:border-gray-700">
                    <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            <FolderKanban className="h-4 w-4 text-blue-600" />
                            {projet.titre}
                          </CardTitle>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                            {projet.description}
                          </p>
                        </div>
                        <Badge className={getStatutBadgeColor(projet.statut)}>
                          {projet.statut}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                      {projetTaches.map((affectation) => {
                        const tache = affectation.SousProjet;
                        const isSelected = selectedTache === tache.id;
                        
                        return (
                          <Card key={tache.id} className="border-l-4 border-l-blue-500">
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <CardTitle className="text-sm font-semibold">
                                      {tache.titre}
                                    </CardTitle>
                                    <Badge className={getStatutBadgeColor(tache.statut)}>
                                      {tache.statut}
                                    </Badge>
                                    {affectation.responsable && (
                                      <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                                        Responsable
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                                    {tache.description}
                                  </p>
                                  {tache.dateDebut && (
                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                      <Calendar className="h-3 w-3" />
                                      Début: {format(new Date(tache.dateDebut), "dd/MM/yyyy", { locale: fr })}
                                    </div>
                                  )}
                                  {tache.dateFin && (
                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                      <Calendar className="h-3 w-3" />
                                      Fin prévue: {format(new Date(tache.dateFin), "dd/MM/yyyy", { locale: fr })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0 space-y-3">
                              {/* Commentaires existants */}
                              {tache.Commentaires && tache.Commentaires.length > 0 && (
                                <div>
                                  <Label className="text-xs font-semibold text-gray-700 flex items-center gap-1 mb-2">
                                    <MessageSquare className="h-3 w-3" />
                                    Commentaires ({tache.Commentaires.length})
                                  </Label>
                                  <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {tache.Commentaires.map((commentaire: any) => (
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
                                          <div className="mt-2">
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

                              {/* Formulaire de commentaire */}
                              {isSelected ? (
                                <div className="space-y-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                                  <Label className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                                    Ajouter un commentaire
                                  </Label>
                                  <Textarea
                                    value={commentaire}
                                    onChange={(e) => setCommentaire(e.target.value)}
                                    placeholder="Décrivez l'évolution de votre tâche..."
                                    rows={3}
                                    className="text-sm"
                                  />
                                  <div className="flex items-center gap-2">
                                    <Label className="text-xs text-gray-600">Avancement (%):</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={pourcentageAvancement}
                                      onChange={(e) => setPourcentageAvancement(e.target.value)}
                                      className="w-20 h-8 text-sm"
                                      placeholder="0-100"
                                    />
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() => handleSubmitCommentaire(tache.id)}
                                      disabled={submitting || !commentaire.trim()}
                                      className="bg-blue-600 hover:bg-blue-700 text-white"
                                    >
                                      {submitting ? (
                                        <>
                                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                          Envoi...
                                        </>
                                      ) : (
                                        <>
                                          <Send className="h-3 w-3 mr-1" />
                                          Envoyer
                                        </>
                                      )}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setSelectedTache(null);
                                        setCommentaire("");
                                        setPourcentageAvancement("");
                                      }}
                                    >
                                      Annuler
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSelectedTache(tache.id)}
                                  className="w-full border-blue-300 hover:bg-blue-50"
                                >
                                  <MessageSquare className="h-4 w-4 mr-2" />
                                  Commenter cette tâche
                                </Button>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  Vous n'avez aucune tâche assignée pour le moment.
                </p>
              </div>
            )}
          </CardContent>
          <div className="p-4 sm:p-6 pt-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <Link href="/user/profile">
              <Button
                variant="outline"
                className="w-full sm:w-auto border-blue-300 dark:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour au profil
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
